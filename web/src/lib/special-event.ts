// =====================================================================
// 特別イベントウィーク — 純粋ロジック（Firestore 非依存）
//
// 流れ:
//   1. 誰でもマイページから提案できる（4種目 / 開始月曜 / 承認者3人）
//   2. 承認者に選ばれた人はアプリを開くたびにポップアップで承認/否認を求められる
//      （否認する場合は理由コメントが必須）
//   3. 3人全員の回答が揃った時点で確定。全員承認なら対象週の上書き設定
//      settings_free/weekly_override_<月曜キー> に書き込み、対象週の週間チャレンジが
//      提案どおりの4種目になる。1人でも否認していれば却下。
//      週ごとに別ドキュメントなので、別々の週を狙った提案が同時に生きていられる。
//   4. 確定したら提案者にポップアップで結果を通知する（否認理由も表示）。
//      一度確認したら resultSeenAt を書き込み、二度は出さない。
//   5. 回答が揃う前なら、提案者は自分の提案を取り下げられる（status: withdrawn）。
//      取り下げた提案は承認者のポップアップにも結果ポップアップにも出てこない。
//
// Firestore アクセスは special-event-engine.ts 側。
// =====================================================================
import type { Timestamp } from 'firebase/firestore';
import { isWeeklyPausedWeekStart } from './raid-mode';
import {
  buildChampionDocMeta,
  formatWeeklyPeriodLabel,
  getWeekBoundaries,
} from './time-jst';
import type { UserData } from './types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 提案に必要な種目数。週間チャレンジの exerciseCount と揃えている。 */
export const SPECIAL_EVENT_EXERCISE_COUNT = 4;
/** 提案に必要な承認者の人数。全員が承認して初めて成立する。 */
export const SPECIAL_EVENT_APPROVER_COUNT = 3;
/** 開始日として選べる週数（次週の月曜から4週分）。 */
export const SPECIAL_EVENT_WEEK_CHOICES = 4;
/** 承認者候補とみなす「直近の投稿」の日数。この期間に1回でも投稿があれば候補。 */
export const SPECIAL_EVENT_ACTIVE_DAYS = 5;
/** 否認理由コメントの最大文字数。提案者へのポップアップで読み切れる長さ。 */
export const SPECIAL_EVENT_COMMENT_MAX = 200;

export type ApprovalDecision = 'approved' | 'rejected';
/** withdrawn = 回答が揃う前に提案者が取り下げた（承認者にはもう聞かない）。 */
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
/**
 * 画面表示用のステータス。expired（回答が揃わないまま対象週が始まった）は
 * Firestore には保存せず、targetWeekStart と現在時刻から毎回導出する。
 * 保存しないのは、期限切れを書き込める人（＝アプリを開いた人）が誰もいない
 * ケースがあるため。導出なら誰が見ても同じ結果になる。
 */
export type ProposalDisplayStatus = ProposalStatus | 'expired';

export interface ApprovalResponse {
  decision: ApprovalDecision;
  at?: Timestamp | null;
  /** 否認理由（decision === 'rejected' のときは必須）。承認時は空。 */
  comment?: string;
}

export interface SpecialEventProposal {
  id: string;
  proposerId: string;
  proposerName: string;
  /** 種目キー（SPECIAL_EVENT_EXERCISE_COUNT 件） */
  exercises: string[];
  /** 表示用の種目名スナップショット（種目が消えても履歴を読める） */
  exerciseNames: string[];
  /** 対象週の開始境界（日曜17:00 JST）。上書き設定の targetWeekStart と同じ。 */
  targetWeekStart: Date;
  /** 対象週の月曜（JST, YYYY-MM-DD） */
  mondayKey: string;
  /** 例: 9/1(月)〜9/5(金) */
  periodLabel: string;
  /** 週間チャレンジに表示されるラベル（overrideLabel） */
  label: string;
  approverIds: string[];
  approverNames: Record<string, string>;
  responses: Record<string, ApprovalResponse>;
  status: ProposalStatus;
  createdAt?: Date | null;
  /** 提案者が結果ポップアップを確認した時刻。未確認なら null。 */
  resultSeenAt?: Date | null;
  /** 提案者が取り下げた時刻。取り下げていなければ null。 */
  withdrawnAt?: Date | null;
}

export interface ApproverCandidate {
  userId: string;
  userName: string;
  /** 直近 SPECIAL_EVENT_ACTIVE_DAYS 日の投稿数 */
  postCount: number;
}

// ---------------------------------------------------------------------
// 承認者候補（直近に投稿している人）
// ---------------------------------------------------------------------
/** 承認者候補の判定に使う「これ以降の投稿」の境界時刻。 */
export function getApproverActiveSince(
  now: Date = new Date(),
  days: number = SPECIAL_EVENT_ACTIVE_DAYS,
): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

/** 投稿数の集計に渡す最小限の形（Firestore の Post から詰め替える）。 */
export interface CandidatePost {
  userId: string;
  value: unknown;
  postedAt: Date | null;
}

/**
 * ユーザーごとの直近投稿数。種目や曜日では絞らない
 * （「過去5日以内に1回でも投稿していれば承認者になれる」ため）。
 */
export function countRecentPosts(
  posts: CandidatePost[],
  since: Date,
): Record<string, number> {
  const counts: Record<string, number> = {};
  const from = since.getTime();
  posts.forEach((post) => {
    if (!post.userId) return;
    if (!post.postedAt || post.postedAt.getTime() < from) return;
    if (!(Number(post.value) > 0)) return;
    counts[post.userId] = (counts[post.userId] || 0) + 1;
  });
  return counts;
}

/** 投稿数マップを候補リストへ。自分とゲストは除き、投稿数の多い順に並べる。 */
export function buildApproverCandidates(
  postCounts: Record<string, number>,
  usersMap: Record<string, UserData>,
  selfUserId: string,
): ApproverCandidate[] {
  return Object.keys(postCounts)
    .filter((uid) => uid !== selfUserId && !usersMap[uid]?.isGuest)
    .map((uid) => ({
      userId: uid,
      userName: usersMap[uid]?.userName || '名無しさん',
      postCount: postCounts[uid],
    }))
    .sort(
      (a, b) => b.postCount - a.postCount || a.userName.localeCompare(b.userName),
    );
}

// ---------------------------------------------------------------------
// 日付ロジック
// ---------------------------------------------------------------------
export interface ProposableWeek {
  /** 週の開始境界（日曜17:00 JST 相当の UTC Date） */
  weekStart: Date;
  /** 週の終了境界（開始 + 7日） */
  weekEnd: Date;
  /** 対象週の月曜（JST, YYYY-MM-DD）。開始日として画面に出す値。 */
  mondayKey: string;
  /** 例: 9/1(月)〜9/5(金) */
  periodLabel: string;
  /** 何週先か（1 = 次週） */
  weeksAhead: number;
  /**
   * 夏休みなどで週間チャレンジ自体が休止する週。休止判定は上書き設定より
   * 先に効くので、提案しても種目にならない。選択肢には出すが選べなくする。
   */
  paused: boolean;
}

/** JST の暦日キー（YYYY-MM-DD）。buildChampionDocMeta の monJST 等を渡す。 */
function toDateKey(jstShifted: Date): string {
  const y = jstShifted.getUTCFullYear();
  const m = String(jstShifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jstShifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 提案できる週の一覧。開始日は月曜のみ・次週の月曜から4週分。
 * 週境界は既存の週間チャレンジと同じ「日曜17:00 JST」起点。
 */
export function getProposableWeeks(
  now: Date = new Date(),
  count: number = SPECIAL_EVENT_WEEK_CHOICES,
): ProposableWeek[] {
  const { start } = getWeekBoundaries(now);
  const weeks: ProposableWeek[] = [];
  for (let i = 1; i <= count; i++) {
    const weekStart = new Date(start.getTime() + i * WEEK_MS);
    const { monJST, friJST } = buildChampionDocMeta(weekStart);
    weeks.push({
      weekStart,
      weekEnd: new Date(weekStart.getTime() + WEEK_MS),
      mondayKey: toDateKey(monJST),
      periodLabel: formatWeeklyPeriodLabel(monJST, friJST),
      weeksAhead: i,
      paused: isWeeklyPausedWeekStart(weekStart),
    });
  }
  return weeks;
}

/**
 * 対象週の上書き設定ドキュメントID。週ごとに分けることで、別々の週を狙った
 * 承認済みイベントが同時に生きていられる（単一ドキュメントだと後勝ちで消える）。
 * ⚠️ app.js / admin.html / weekly-engine.ts と同じ命名にすること。
 */
export function weeklyOverrideDocId(mondayKey: string): string {
  return `weekly_override_${mondayKey}`;
}

/** 上書き設定ドキュメントのうち、適用するかどうかの判断に要る部分だけ。 */
export interface OverrideCandidate {
  invalidated?: boolean;
  exercises?: string[];
  /** 対象週の開始境界。旧々形式では持っていない */
  targetWeekStart?: Date | null;
}

/**
 * 週切り替え時に、どの上書き設定をこの週へ適用するかを決める。
 *
 * - week   … 対象週ごとのドキュメント（現行）。あればこれが最優先
 * - legacy … 週で分けていなかった単一ドキュメント（旧形式）。対象週が
 *            一致するか、対象週を持たない旧々形式のときだけ使う
 * - null   … どちらも使わない（自動選出へ）
 *
 * cleanupLegacy は「旧形式の設定を無効化してよいか」。無効化してよいのは
 * 対象週が過ぎたものだけで、まだ来ていない週を狙った設定は絶対に消さない。
 * 以前はここで未来ぶんも消していたため、2週先以降を狙った承認済みイベントが
 * 手前の週切り替えで失われていた。
 */
export function planWeeklyOverride(input: {
  weekOverride: OverrideCandidate | null;
  legacyOverride: OverrideCandidate | null;
  weekStart: Date;
}): { use: 'week' | 'legacy' | null; cleanupLegacy: boolean } {
  const usable = (o: OverrideCandidate | null): boolean =>
    !!o && !o.invalidated && Array.isArray(o.exercises) && o.exercises.length > 0;

  if (usable(input.weekOverride)) return { use: 'week', cleanupLegacy: false };
  if (!usable(input.legacyOverride)) return { use: null, cleanupLegacy: false };

  const target = input.legacyOverride?.targetWeekStart;
  // 旧々形式（対象週なし）は後方互換でそのまま適用する
  if (!target) return { use: 'legacy', cleanupLegacy: false };
  if (Math.abs(target.getTime() - input.weekStart.getTime()) < 60 * 1000) {
    return { use: 'legacy', cleanupLegacy: false };
  }
  // 過ぎた週ぶんだけ掃除。先の週ぶんはそのまま残す
  return { use: null, cleanupLegacy: target.getTime() < input.weekStart.getTime() };
}

/** 週の開始境界（日曜17:00 JST）から対象週の月曜キー（JST, YYYY-MM-DD）。 */
export function mondayKeyOfWeekStart(weekStart: Date): string {
  const { monJST } = buildChampionDocMeta(weekStart);
  return toDateKey(monJST);
}

/** 対象週の開始前で、まだ上書き設定に反映できるか。 */
export function isTargetWeekUpcoming(
  targetWeekStart: Date,
  now: Date = new Date(),
): boolean {
  return targetWeekStart.getTime() > now.getTime();
}

// ---------------------------------------------------------------------
// 承認状態の判定
// ---------------------------------------------------------------------
/**
 * 承認者全員の回答から提案のステータスを求める。
 *
 * 全員（SPECIAL_EVENT_APPROVER_COUNT 人）の回答が揃うまでは pending のまま。
 * 揃った時点で、1人でも否認していれば rejected、全員承認なら approved。
 * 早い者勝ちで打ち切らないのは、提案者に3人ぶんの結果（否認理由を含む）を
 * まとめて返すため。
 */
export function resolveProposalStatus(
  approverIds: string[],
  responses: Record<string, ApprovalResponse>,
): ProposalStatus {
  const ids = approverIds || [];
  if (ids.length === 0) return 'pending';
  if (!ids.every((uid) => responses?.[uid]?.decision)) return 'pending';
  return ids.some((uid) => responses[uid].decision === 'rejected')
    ? 'rejected'
    : 'approved';
}

/**
 * 保存済み status と対象週から、画面に出すステータスを求める。
 *
 * 回答が揃わないまま対象週が始まってしまった提案は、もう上書き設定に
 * 反映できないので expired（期限切れ）として扱う。Firestore の status は
 * pending のままなので、表示・通知はすべてこの関数を通すこと。
 */
export function resolveDisplayStatus(
  proposal: Pick<SpecialEventProposal, 'status' | 'targetWeekStart'>,
  now: Date = new Date(),
): ProposalDisplayStatus {
  if (
    proposal.status === 'pending' &&
    !isTargetWeekUpcoming(proposal.targetWeekStart, now)
  ) {
    return 'expired';
  }
  return proposal.status;
}

/**
 * この提案について、そのユーザーにポップアップで聞くべきか。
 * 承認か否認を選ぶまで true を返し続けるので、回答漏れが起きない。
 */
export function needsResponseFrom(
  proposal: Pick<
    SpecialEventProposal,
    'status' | 'approverIds' | 'responses' | 'targetWeekStart'
  >,
  userId: string,
  now: Date = new Date(),
): boolean {
  if (proposal.status !== 'pending') return false;
  if (!proposal.approverIds.includes(userId)) return false;
  // 他の誰かが先に否認していても、3人ぶんの意見を集めるので最後まで聞く
  if (proposal.responses?.[userId]) return false;
  // 対象週が始まってしまった提案はもう反映できないので聞かない
  return isTargetWeekUpcoming(proposal.targetWeekStart, now);
}

/**
 * 提案者が自分でこの提案を取り下げられるか。
 *
 * 取り下げられるのは「自分の提案」かつ「まだ回答が揃っていない（pending）」もの
 * だけ。確定してからでは上書き設定に反映済みかもしれないので触らせない。
 * 承認者が何人か回答済みでも、揃うまでは取り下げてよい。
 *
 * 対象週が始まってしまった提案（expired）も対象外。もう反映されないので
 * 取り下げる意味がなく、提案者には結果ポップアップで期限切れを伝える。
 */
export function canWithdrawProposal(
  proposal: Pick<SpecialEventProposal, 'status' | 'proposerId' | 'targetWeekStart'>,
  userId: string,
  now: Date = new Date(),
): boolean {
  if (!userId || proposal.proposerId !== userId) return false;
  return resolveDisplayStatus(proposal, now) === 'pending';
}

/** 「承認2/3」のような進捗サマリ。 */
export function summarizeResponses(
  approverIds: string[],
  responses: Record<string, ApprovalResponse>,
): { approved: number; rejected: number; pending: number; total: number } {
  let approved = 0;
  let rejected = 0;
  (approverIds || []).forEach((uid) => {
    const d = responses?.[uid]?.decision;
    if (d === 'approved') approved++;
    else if (d === 'rejected') rejected++;
  });
  const total = (approverIds || []).length;
  return { approved, rejected, pending: total - approved - rejected, total };
}

// ---------------------------------------------------------------------
// 否認コメント
// ---------------------------------------------------------------------
/**
 * 否認理由コメントの入力チェック。エラー文言（問題なければ null）を返す。
 * 否認は必ず一言そえてもらう（提案者が次に活かせるようにするため）。
 */
export function validateDecisionComment(
  decision: ApprovalDecision,
  comment: string,
): string | null {
  if (decision !== 'rejected') return null;
  const trimmed = (comment || '').trim();
  if (!trimmed) return '否認する場合は理由を入力してください';
  if (trimmed.length > SPECIAL_EVENT_COMMENT_MAX) {
    return `理由は${SPECIAL_EVENT_COMMENT_MAX}文字以内で入力してください`;
  }
  return null;
}

/** 保存用に整えたコメント。承認時は空文字（Firestore に undefined を渡さない）。 */
export function normalizeDecisionComment(
  decision: ApprovalDecision,
  comment: string,
): string {
  if (decision !== 'rejected') return '';
  return (comment || '').trim().slice(0, SPECIAL_EVENT_COMMENT_MAX);
}

// ---------------------------------------------------------------------
// 提案者への結果通知
// ---------------------------------------------------------------------
export interface ProposalDecisionEntry {
  userId: string;
  userName: string;
  decision: ApprovalDecision | null;
  /** 否認理由（否認以外は空） */
  comment: string;
}

/**
 * 提案者に結果ポップアップを出すべきか。
 * 3人の回答が揃って status が確定した提案と、回答が揃わないまま対象週が
 * 始まってしまった提案（expired）のうち、まだ本人が確認していないものが対象。
 *
 * 自分で取り下げた提案は結果を知らせる意味がないので出さない
 * （出すと「否認されました」と同じ見た目で驚かせてしまう）。
 */
export function needsResultNoticeFor(
  proposal: Pick<
    SpecialEventProposal,
    'status' | 'proposerId' | 'resultSeenAt' | 'targetWeekStart'
  >,
  userId: string,
  now: Date = new Date(),
): boolean {
  if (proposal.proposerId !== userId) return false;
  if (proposal.status === 'withdrawn') return false;
  if (resolveDisplayStatus(proposal, now) === 'pending') return false;
  return !proposal.resultSeenAt;
}

/** 承認者ごとの回答一覧（提案時に選んだ順）。結果ポップアップの明細に使う。 */
export function listDecisions(
  proposal: Pick<
    SpecialEventProposal,
    'approverIds' | 'approverNames' | 'responses'
  >,
): ProposalDecisionEntry[] {
  return (proposal.approverIds || []).map((uid) => {
    const res = proposal.responses?.[uid];
    return {
      userId: uid,
      userName: proposal.approverNames?.[uid] || '名無しさん',
      decision: res?.decision || null,
      comment: res?.decision === 'rejected' ? res.comment || '' : '',
    };
  });
}

/** 否認した人だけを抜き出す（提案者に見せる否認理由の一覧）。 */
export function listRejections(
  proposal: Pick<
    SpecialEventProposal,
    'approverIds' | 'approverNames' | 'responses'
  >,
): ProposalDecisionEntry[] {
  return listDecisions(proposal).filter((d) => d.decision === 'rejected');
}

// ---------------------------------------------------------------------
// 承認済み提案が実際に対象週へ反映されたか
// ---------------------------------------------------------------------
/**
 * 対象週の上書き設定ドキュメント（settings_free/weekly_override_<月曜キー>）の
 * 中身のうち、「どの提案が勝ったか」を判定するのに要る部分だけ。
 */
export interface WeekOverrideSnapshot {
  exists: boolean;
  /** 書き込んだ提案のID。管理画面の手動上書きでは空。 */
  proposalId?: string | null;
  /** 週間チャレンジに出るラベル（「特別イベント（◯◯提案）」など）。 */
  label?: string | null;
  /** 'special_event_proposal' | 'admin' */
  source?: string | null;
}

/**
 * 承認された提案が対象週に反映されたか。
 *
 * 同じ週に複数の提案が出ても止めていないので、後から承認確定した方が
 * 上書きする。負けた側の提案者に「承認されたが別のイベントに上書きされた」と
 * 分かるようにするための判定。
 *
 * - applied     … この提案が対象週の種目になっている
 * - superseded  … 承認はされたが、別の提案／管理者の設定に上書きされた
 * - unknown     … 判定材料がない（週ごとドキュメント導入前に承認された提案など）。
 *                 素直に「承認されました」とだけ伝える
 */
export type ApprovedOutcome =
  | { kind: 'applied' }
  | { kind: 'superseded'; byLabel: string; byAdmin: boolean }
  | { kind: 'unknown' };

export function resolveApprovedOutcome(
  proposal: Pick<SpecialEventProposal, 'id'>,
  override: WeekOverrideSnapshot | null,
): ApprovedOutcome {
  if (!override || !override.exists) return { kind: 'unknown' };
  if (override.proposalId && override.proposalId === proposal.id) {
    return { kind: 'applied' };
  }
  return {
    kind: 'superseded',
    byLabel: override.label || '別の設定',
    byAdmin: !override.proposalId,
  };
}

/** 提案フォームの入力チェック。エラー文言（無ければ null）を返す。 */
export function validateProposalInput(input: {
  exercises: string[];
  weekStart: Date | null;
  approverIds: string[];
}): string | null {
  if (input.exercises.length !== SPECIAL_EVENT_EXERCISE_COUNT) {
    return `種目を${SPECIAL_EVENT_EXERCISE_COUNT}種類選んでください`;
  }
  if (new Set(input.exercises).size !== input.exercises.length) {
    return '同じ種目は選べません';
  }
  if (!input.weekStart) return '開始日を選んでください';
  if (isWeeklyPausedWeekStart(input.weekStart)) {
    return 'その週は週間チャレンジが休止しているため選べません';
  }
  if (input.approverIds.length !== SPECIAL_EVENT_APPROVER_COUNT) {
    return `承認者を${SPECIAL_EVENT_APPROVER_COUNT}人選んでください`;
  }
  if (new Set(input.approverIds).size !== input.approverIds.length) {
    return '同じ人を複数選べません';
  }
  return null;
}
