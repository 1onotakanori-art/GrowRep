// =====================================================================
// 特別イベントウィーク — Firestore オーケストレーション
//
// コレクション: special_event_proposals
// 3人全員の承認が揃った時点で settings_free/weekly_override を書き込み、
// 対象週の週間チャレンジを提案どおりの種目に差し替える。
//
// ⚠️ weekly_override のフィールド形状は app.js / admin.html /
//    lib/weekly-engine.ts が読む既存仕様。変更しないこと。
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
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { getWeeklyPosts } from './posts';
import { buildChampionDocMeta, getWeekBoundaries, isWeekdayJST } from './time-jst';
import {
  isTargetWeekUpcoming,
  resolveProposalStatus,
  validateProposalInput,
  type ApprovalDecision,
  type ApprovalResponse,
  type ApproverCandidate,
  type ProposableWeek,
  type ProposalStatus,
  type SpecialEventProposal,
} from './special-event';
import type { FreeExerciseMap, UserData } from './types';

const COL = 'special_event_proposals';
const SETTINGS = 'settings_free';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------
// 承認者候補（前週の週間チャレンジに投稿した人）
// ---------------------------------------------------------------------
/**
 * 前週の週間チャレンジに投稿しているユーザーを返す（自分とゲストは除く）。
 * 種目は weekly_challenge_history に残る前週の選出種目で絞り込む。
 * 履歴が無い週（休止週など）は、その週の投稿者全員を候補にする。
 */
export async function loadPreviousWeekParticipants(
  usersMap: Record<string, UserData>,
  selfUserId: string,
  now: Date = new Date(),
): Promise<ApproverCandidate[]> {
  const { start } = getWeekBoundaries(now);
  const prevStart = new Date(start.getTime() - WEEK_MS);
  const prevEnd = start;

  let prevKeys: string[] = [];
  try {
    const { docId } = buildChampionDocMeta(prevStart);
    const snap = await getDoc(doc(db, 'weekly_challenge_history', docId));
    if (snap.exists()) {
      const data = snap.data() as { exercises?: string[] };
      prevKeys = Array.isArray(data.exercises) ? data.exercises : [];
    }
  } catch (e) {
    console.warn(
      '[特別イベント] 前週の種目取得に失敗、投稿者全員を候補にします:',
      e,
    );
  }

  const posts = await getWeeklyPosts(prevStart, prevEnd);
  const counts: Record<string, number> = {};
  posts.forEach((post) => {
    const ts = post.timestamp as Timestamp | null | undefined;
    if (!ts) return;
    if (!isWeekdayJST(ts.toDate())) return;
    if (prevKeys.length > 0 && !prevKeys.includes(post.exerciseType)) return;
    if (!(Number(post.value) > 0)) return;
    counts[post.userId] = (counts[post.userId] || 0) + 1;
  });

  return Object.keys(counts)
    .filter((uid) => uid !== selfUserId && !usersMap[uid]?.isGuest)
    .map((uid) => ({
      userId: uid,
      userName: usersMap[uid]?.userName || '名無しさん',
      postCount: counts[uid],
    }))
    .sort(
      (a, b) => b.postCount - a.postCount || a.userName.localeCompare(b.userName),
    );
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

/** 対象週ごとの既存提案（開始日の選択肢に「申請中 / 確定済み」を出すため）。 */
export async function loadProposalsByWeek(): Promise<
  Record<string, { pending: number; approved: number }>
> {
  const snap = await getDocs(collection(db, COL));
  const byWeek: Record<string, { pending: number; approved: number }> = {};
  snap.docs.forEach((d) => {
    const p = toProposal(d.id, d.data() as ProposalDoc);
    if (!p.mondayKey) return;
    const slot = byWeek[p.mondayKey] || { pending: 0, approved: 0 };
    if (p.status === 'pending') slot.pending++;
    else if (p.status === 'approved') slot.approved++;
    byWeek[p.mondayKey] = slot;
  });
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

/** 提案を作成する。入力の妥当性はここでも最終チェックする。 */
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

  const ref = await addDoc(collection(db, COL), {
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
  return ref.id;
}

/**
 * 承認/否認を記録する。承認者全員の承認で weekly_override へ反映。
 * 同時回答に備えてトランザクションで読み直してから書く。
 */
export async function respondToProposal(
  proposalId: string,
  userId: string,
  decision: ApprovalDecision,
): Promise<ProposalStatus> {
  const ref = doc(db, COL, proposalId);

  const nextStatus = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('提案が見つかりません');
    const data = snap.data() as ProposalDoc;
    const approverIds = data.approverIds || [];
    if (!approverIds.includes(userId)) {
      throw new Error('この提案の承認者ではありません');
    }
    const current = data.status || 'pending';
    if (current !== 'pending') return current;

    const responses: Record<string, ApprovalResponse> = {
      ...(data.responses || {}),
      [userId]: { decision, at: Timestamp.now() },
    };
    const status = resolveProposalStatus(approverIds, responses);
    tx.update(ref, { responses, status, updatedAt: serverTimestamp() });
    return status;
  });

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
 * 承認済みの提案を weekly_override に反映する。
 * 対象週が始まる前だけ書き込む（過ぎていたら反映しない）。
 */
export async function applyApprovedProposal(
  proposal: SpecialEventProposal,
  now: Date = new Date(),
): Promise<boolean> {
  if (!isTargetWeekUpcoming(proposal.targetWeekStart, now)) return false;
  await setDoc(doc(db, SETTINGS, 'weekly_override'), {
    exercises: proposal.exercises,
    label: proposal.label,
    targetWeekStart: Timestamp.fromDate(proposal.targetWeekStart),
    invalidated: false,
    setAt: serverTimestamp(),
    setBy: proposal.proposerId,
    source: 'special_event_proposal',
    proposalId: proposal.id,
  });
  return true;
}
