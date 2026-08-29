// =====================================================================
// 特別イベントウィーク — Firestore オーケストレーション
//
// コレクション: special_event_proposals
// 3人全員の回答が揃った時点で結果が確定し、全員承認なら
// settings_free/weekly_override_<対象週の月曜キー> を書き込んで対象週の
// 週間チャレンジを提案どおりの種目に差し替える。否認理由は
// responses[uid].comment に残り、提案者への結果ポップアップで表示される。
//
// 上書き設定を週ごとのドキュメントに分けているのは、別々の週を狙った
// 承認済みイベントを同時に生かしておくため（単一ドキュメントだと後から
// 承認された週が前の週の設定を消してしまう）。
//
// ⚠️ 上書き設定のフィールド形状とドキュメントIDは app.js / admin.html /
//    lib/weekly-engine.ts が読む既存仕様。変更したら全部そろえること。
// =====================================================================
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { getPostsSince, getPostsSinceFromCache } from './posts';
import {
  buildApproverCandidates,
  canWithdrawProposal,
  countRecentPosts,
  getApproverActiveSince,
  isTargetWeekUpcoming,
  normalizeDecisionComment,
  resolveApprovedOutcome,
  resolveProposalStatus,
  validateDecisionComment,
  validateProposalInput,
  weeklyOverrideDocId,
  SPECIAL_EVENT_APPROVER_COUNT,
  type ApprovalDecision,
  type ApprovalResponse,
  type ApproverCandidate,
  type ApprovedOutcome,
  type CandidatePost,
  type ProposableWeek,
  type ProposalStatus,
  type SpecialEventProposal,
  type WeekOverrideSnapshot,
} from './special-event';
import type { FreeExerciseMap, Post, UserData } from './types';

/**
 * Firestore の permission-denied を、原因の分かる日本語にして返す。
 *
 * special_event_proposals は後から足したコレクションなので、
 * firestore.rules を本番へデプロイし忘れていると「ルール未定義＝全拒否」で
 * 落ちる。素の "Missing or insufficient permissions." のままだと
 * 何が悪いのか分からないため、対処法まで書いて投げ直す。
 */
function toSpecialEventError(e: unknown, fallbackMessage: string): Error {
  if (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === 'permission-denied'
  ) {
    return new Error(
      'Firestore に拒否されました。firestore.rules が本番に反映されていない可能性があります' +
        '（./scripts/deploy-firestore-rules.sh を実行してください）',
    );
  }
  return e instanceof Error ? e : new Error(fallbackMessage);
}

const COL = 'special_event_proposals';
const SETTINGS = 'settings_free';
/** 承認者候補・週別利用状況のメモリキャッシュ寿命。users のキャッシュと同じ5分。 */
const CANDIDATE_CACHE_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------
// 承認者候補（過去5日以内に投稿した人）
// ---------------------------------------------------------------------
function toCandidatePosts(posts: Post[]): CandidatePost[] {
  return posts.map((p) => {
    const ts = p.timestamp as Timestamp | null | undefined;
    return {
      userId: p.userId,
      value: p.value,
      postedAt: ts ? ts.toDate() : null,
    };
  });
}

/** 直近投稿数のメモリキャッシュ。モーダルの開き直しでサーバー往復を省く。 */
let postCountsCache: { at: number; counts: Record<string, number> } | null =
  null;

async function fetchRecentPostCounts(
  now: Date,
): Promise<Record<string, number>> {
  const since = getApproverActiveSince(now);
  const posts = await getPostsSince(since);
  const counts = countRecentPosts(toCandidatePosts(posts), since);
  postCountsCache = { at: Date.now(), counts };
  return counts;
}

/**
 * 承認者候補（過去5日以内に1回でも投稿しているユーザー。自分とゲストは除く）。
 *
 * 速度のための3段構え:
 *   1. メモリキャッシュが新しければ即返す（サーバー往復ゼロ）
 *   2. onPartial 指定時は IndexedDB キャッシュ分を先に渡して即描画
 *   3. サーバーの最新で確定させる
 */
export async function loadApproverCandidates(
  usersMap: Record<string, UserData>,
  selfUserId: string,
  opts: {
    now?: Date;
    /** キャッシュ由来の暫定リスト（サーバー確定前に描画するため） */
    onPartial?: (list: ApproverCandidate[]) => void;
  } = {},
): Promise<ApproverCandidate[]> {
  const now = opts.now || new Date();
  const build = (counts: Record<string, number>) =>
    buildApproverCandidates(counts, usersMap, selfUserId);

  if (postCountsCache && Date.now() - postCountsCache.at < CANDIDATE_CACHE_MS) {
    const cached = build(postCountsCache.counts);
    // 人数が足りない時だけは、誰かが投稿した直後でも提案できるよう取り直す
    if (cached.length >= SPECIAL_EVENT_APPROVER_COUNT) return cached;
  }

  // サーバー取得は先に走らせ、その裏でローカルキャッシュ分を暫定表示する
  const fresh = fetchRecentPostCounts(now);
  fresh.catch(() => {}); // await 前に失敗しても unhandledrejection にしない
  if (opts.onPartial) {
    const since = getApproverActiveSince(now);
    const cached = await getPostsSinceFromCache(since);
    if (cached) {
      opts.onPartial(build(countRecentPosts(toCandidatePosts(cached), since)));
    }
  }

  return build(await fresh);
}

/**
 * 提案フォームで使うデータを先読みしておく（マイページを開いた時点など）。
 * 失敗しても無視する。ボタンを押した時にはキャッシュ済みで即表示できる。
 */
export function prefetchProposalFormData(mondayKeys?: string[]): void {
  if (!postCountsCache || Date.now() - postCountsCache.at >= CANDIDATE_CACHE_MS) {
    fetchRecentPostCounts(new Date()).catch(() => {});
  }
  loadProposalsByWeek(mondayKeys).catch(() => {});
}

// ---------------------------------------------------------------------
// 読み取り
// ---------------------------------------------------------------------
interface ProposalDoc {
  proposerId?: string;
  proposerName?: string;
  exercises?: string[];
  exerciseNames?: string[];
  targetWeekStart?: Timestamp;
  mondayKey?: string;
  periodLabel?: string;
  label?: string;
  approverIds?: string[];
  approverNames?: Record<string, string>;
  responses?: Record<string, ApprovalResponse>;
  status?: ProposalStatus;
  createdAt?: Timestamp;
  resultSeenAt?: Timestamp;
  withdrawnAt?: Timestamp;
}

function toProposal(id: string, data: ProposalDoc): SpecialEventProposal {
  const approverIds = data.approverIds || [];
  const responses = data.responses || {};
  return {
    id,
    proposerId: data.proposerId || '',
    proposerName: data.proposerName || '名無しさん',
    exercises: data.exercises || [],
    exerciseNames: data.exerciseNames || [],
    targetWeekStart: data.targetWeekStart
      ? data.targetWeekStart.toDate()
      : new Date(0),
    mondayKey: data.mondayKey || '',
    periodLabel: data.periodLabel || '',
    label: data.label || '特別イベントウィーク',
    approverIds,
    approverNames: data.approverNames || {},
    responses,
    status: data.status || resolveProposalStatus(approverIds, responses),
    createdAt: data.createdAt ? data.createdAt.toDate() : null,
    resultSeenAt: data.resultSeenAt ? data.resultSeenAt.toDate() : null,
    withdrawnAt: data.withdrawnAt ? data.withdrawnAt.toDate() : null,
  };
}

/** 自分が承認者になっている提案をすべて取得（対象週の新しい順）。 */
export async function loadProposalsForApprover(
  userId: string,
): Promise<SpecialEventProposal[]> {
  // array-contains 単体なら自動インデックスで済むので、status は
  // クライアント側で絞る（6人規模でドキュメント数はごく少ない）。
  const snap = await getDocs(
    query(collection(db, COL), where('approverIds', 'array-contains', userId)),
  );
  return snap.docs
    .map((d) => toProposal(d.id, d.data() as ProposalDoc))
    .sort((a, b) => b.targetWeekStart.getTime() - a.targetWeekStart.getTime());
}

/** 自分が出した提案をすべて取得（対象週の新しい順）。 */
export async function loadMyProposals(
  userId: string,
): Promise<SpecialEventProposal[]> {
  const snap = await getDocs(
    query(collection(db, COL), where('proposerId', '==', userId)),
  );
  return snap.docs
    .map((d) => toProposal(d.id, d.data() as ProposalDoc))
    .sort((a, b) => b.targetWeekStart.getTime() - a.targetWeekStart.getTime());
}

type WeekUsage = Record<string, { pending: number; approved: number }>;

let weekUsageCache: { at: number; key: string; data: WeekUsage } | null = null;

/**
 * 対象週ごとの既存提案（開始日の選択肢に「申請中 / 確定済み」を出すため）。
 * mondayKeys を渡すとその週だけを引く（コレクション全件スキャンを避ける）。
 */
export async function loadProposalsByWeek(
  mondayKeys?: string[],
): Promise<WeekUsage> {
  // Firestore の in は最大10件。提案できるのは4週分なので通常はそのまま収まる。
  const keys = mondayKeys?.slice(0, 10);
  const cacheKey = keys ? keys.join(',') : '*';
  if (
    weekUsageCache &&
    weekUsageCache.key === cacheKey &&
    Date.now() - weekUsageCache.at < CANDIDATE_CACHE_MS
  ) {
    return weekUsageCache.data;
  }

  const ref = collection(db, COL);
  const snap = await getDocs(
    keys && keys.length > 0 ? query(ref, where('mondayKey', 'in', keys)) : ref,
  );
  const byWeek: WeekUsage = {};
  snap.docs.forEach((d) => {
    const p = toProposal(d.id, d.data() as ProposalDoc);
    if (!p.mondayKey) return;
    const slot = byWeek[p.mondayKey] || { pending: 0, approved: 0 };
    if (p.status === 'pending') slot.pending++;
    else if (p.status === 'approved') slot.approved++;
    byWeek[p.mondayKey] = slot;
  });
  weekUsageCache = { at: Date.now(), key: cacheKey, data: byWeek };
  return byWeek;
}

// ---------------------------------------------------------------------
// 書き込み
// ---------------------------------------------------------------------
export interface CreateProposalInput {
  proposer: { uid: string; name: string };
  exercises: string[];
  week: ProposableWeek;
  approvers: { userId: string; userName: string }[];
  freeExercises: FreeExerciseMap;
}

/**
 * 提案を作成する。入力の妥当性はここでも最終チェックする。
 * 種目の組み合わせに制限はない（タイムアタックは何個でも選べる）。
 */
export async function createSpecialEventProposal(
  input: CreateProposalInput,
): Promise<string> {
  const { proposer, exercises, week, approvers, freeExercises } = input;
  const invalid = validateProposalInput({
    exercises,
    weekStart: week?.weekStart || null,
    approverIds: approvers.map((a) => a.userId),
  });
  if (invalid) throw new Error(invalid);
  if (!isTargetWeekUpcoming(week.weekStart)) {
    throw new Error('開始日が過ぎています。読み込み直してください');
  }

  const approverNames: Record<string, string> = {};
  approvers.forEach((a) => {
    approverNames[a.userId] = a.userName;
  });

  let ref;
  try {
    ref = await addDoc(collection(db, COL), {
      proposerId: proposer.uid,
      proposerName: proposer.name,
      exercises,
      exerciseNames: exercises.map((k) => freeExercises[k]?.name || k),
      targetWeekStart: Timestamp.fromDate(week.weekStart),
      mondayKey: week.mondayKey,
      periodLabel: week.periodLabel,
      label: `特別イベント（${proposer.name}提案）`,
      approverIds: approvers.map((a) => a.userId),
      approverNames,
      responses: {},
      status: 'pending' as ProposalStatus,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('[特別イベント] 提案の作成に失敗:', e);
    throw toSpecialEventError(e, '提案の送信に失敗しました');
  }
  weekUsageCache = null;
  return ref.id;
}

/**
 * 承認/否認を記録する。3人の回答が揃い、全員承認だった時だけ
 * 対象週の上書き設定へ反映する。同時回答に備えてトランザクションで
 * 読み直してから書く。
 *
 * 否認の場合は理由コメントが必須（提案者へのポップアップで表示する）。
 */
export async function respondToProposal(
  proposalId: string,
  userId: string,
  decision: ApprovalDecision,
  comment: string = '',
): Promise<ProposalStatus> {
  const invalidComment = validateDecisionComment(decision, comment);
  if (invalidComment) throw new Error(invalidComment);
  const ref = doc(db, COL, proposalId);

  let nextStatus: ProposalStatus;
  try {
    nextStatus = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('提案が見つかりません');
      const data = snap.data() as ProposalDoc;
      const approverIds = data.approverIds || [];
      if (!approverIds.includes(userId)) {
        throw new Error('この提案の承認者ではありません');
      }
      const current = data.status || 'pending';
      if (current !== 'pending') return current;
      // ポップアップを開いたまま週境界（日曜17:00 JST）をまたいだ場合。
      // ここで承認を通すと status だけ approved になって上書き設定は書けない
      // （＝提案者に「承認されました」と嘘をつく）ので、回答自体を断る。
      const targetWeekStart = data.targetWeekStart
        ? data.targetWeekStart.toDate()
        : new Date(0);
      if (!isTargetWeekUpcoming(targetWeekStart)) {
        throw new Error(
          '対象週が始まったため、この提案は期限切れです（回答は記録されません）',
        );
      }

      const responses: Record<string, ApprovalResponse> = {
        ...(data.responses || {}),
        [userId]: {
          decision,
          at: Timestamp.now(),
          comment: normalizeDecisionComment(decision, comment),
        },
      };
      const status = resolveProposalStatus(approverIds, responses);
      tx.update(ref, { responses, status, updatedAt: serverTimestamp() });
      return status;
    });
  } catch (e) {
    console.error('[特別イベント] 承認/否認の記録に失敗:', e);
    throw toSpecialEventError(e, '回答の送信に失敗しました');
  }
  weekUsageCache = null;

  if (nextStatus === 'approved') {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await applyApprovedProposal(
        toProposal(snap.id, snap.data() as ProposalDoc),
      );
    }
  }
  return nextStatus;
}

/**
 * 自分の提案を取り下げる（pending → withdrawn）。
 *
 * 承認者の回答が1つでも入っている途中でも取り下げてよい。ただし3人ぶんが
 * 揃って status が確定したあとは触らせない（上書き設定へ反映済みの
 * 可能性があるため）。取り下げと同時に別の承認者が回答して確定する競合が
 * あるので、トランザクションで status を読み直してから書く。
 */
export async function withdrawProposal(
  proposalId: string,
  userId: string,
): Promise<void> {
  const ref = doc(db, COL, proposalId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('提案が見つかりません');
      const proposal = toProposal(snap.id, snap.data() as ProposalDoc);
      if (proposal.proposerId !== userId) {
        throw new Error('自分が出した提案だけ取り下げられます');
      }
      if (proposal.status === 'withdrawn') return; // 二重クリックは成功扱い
      if (proposal.status !== 'pending') {
        throw new Error(
          'すでに承認者全員の回答が揃っているため取り下げられません',
        );
      }
      if (!canWithdrawProposal(proposal, userId)) {
        throw new Error('対象週が始まっているため取り下げられません');
      }
      tx.update(ref, {
        status: 'withdrawn' as ProposalStatus,
        withdrawnAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (e) {
    console.error('[特別イベント] 提案の取り下げに失敗:', e);
    throw toSpecialEventError(e, '提案の取り下げに失敗しました');
  }
  // 取り下げた週は「申請中」ではなくなるので、選択肢の表示を作り直させる
  weekUsageCache = null;
}

/**
 * 提案者が結果ポップアップを確認したことを記録する。
 * これを書いた提案は二度とポップアップに出てこない。
 */
export async function markProposalResultSeen(proposalId: string): Promise<void> {
  await updateDoc(doc(db, COL, proposalId), {
    resultSeenAt: serverTimestamp(),
  });
}

/**
 * 承認済みの提案を対象週の上書き設定に反映する。
 * 対象週が始まる前だけ書き込む（過ぎていたら反映しない）。
 *
 * 書き込み先は週ごとのドキュメント settings_free/weekly_override_<月曜キー>。
 * 他の週を狙った承認済みイベントとは別ドキュメントなので潰し合わない。
 * 同じ週に複数の提案が承認された場合だけは後勝ちで、負けた側の提案者には
 * 結果ポップアップで「別のイベントに上書きされた」と伝える
 * （loadApprovedOutcome / resolveApprovedOutcome）。
 */
export async function applyApprovedProposal(
  proposal: SpecialEventProposal,
  now: Date = new Date(),
): Promise<boolean> {
  if (!isTargetWeekUpcoming(proposal.targetWeekStart, now)) return false;
  await setDoc(doc(db, SETTINGS, weeklyOverrideDocId(proposal.mondayKey)), {
    exercises: proposal.exercises,
    label: proposal.label,
    targetWeekStart: Timestamp.fromDate(proposal.targetWeekStart),
    mondayKey: proposal.mondayKey,
    invalidated: false,
    setAt: serverTimestamp(),
    setBy: proposal.proposerId,
    source: 'special_event_proposal',
    proposalId: proposal.id,
  });
  return true;
}

/** 対象週の上書き設定を読む（「どの提案が勝ったか」の判定材料）。 */
export async function loadWeekOverrideSnapshot(
  mondayKey: string,
): Promise<WeekOverrideSnapshot> {
  if (!mondayKey) return { exists: false };
  try {
    const snap = await getDoc(doc(db, SETTINGS, weeklyOverrideDocId(mondayKey)));
    if (!snap.exists()) return { exists: false };
    const data = snap.data() as {
      proposalId?: string;
      label?: string;
      source?: string;
    };
    return {
      exists: true,
      proposalId: data.proposalId || null,
      label: data.label || null,
      source: data.source || null,
    };
  } catch (e) {
    console.warn('[特別イベント] 対象週の上書き設定を読めませんでした:', e);
    return { exists: false };
  }
}

/**
 * 承認された提案が実際に対象週へ反映されたか（別のイベントに上書きされて
 * いないか）を調べる。結果ポップアップと一覧の表示に使う。
 */
export async function loadApprovedOutcome(
  proposal: SpecialEventProposal,
): Promise<ApprovedOutcome> {
  const override = await loadWeekOverrideSnapshot(proposal.mondayKey);
  return resolveApprovedOutcome(proposal, override);
}
