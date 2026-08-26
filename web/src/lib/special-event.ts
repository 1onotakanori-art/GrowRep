// =====================================================================
// 特別イベントウィーク — 純粋ロジック（Firestore 非依存）
//
// 流れ:
//   1. 誰でもマイページから提案できる（4種目 / 開始月曜 / 承認者3人）
//   2. 承認者に選ばれた人はアプリを開くたびにポップアップで承認/否認を求められる
//      （否認する場合は理由コメントが必須）
//   3. 3人全員の回答が揃った時点で確定。全員承認なら settings_free/weekly_override
//      に書き込み、対象週の週間チャレンジが提案どおりの4種目になる。
//      1人でも否認していれば却下。
//   4. 確定したら提案者にポップアップで結果を通知する（否認理由も表示）。
//      一度確認したら resultSeenAt を書き込み、二度は出さない。
//
// Firestore アクセスは special-event-engine.ts 側。
// =====================================================================
import type { Timestamp } from 'firebase/firestore';
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
export type ProposalStatus = 'pending' | 'approved' | 'rejected';

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
  /** 対象週の開始境界（日曜17:00 JST）。weekly_override.targetWeekStart と同じ。 */
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
    });
  }
  return weeks;
}

/** 対象週の開始前で、まだ weekly_override に反映できるか。 */
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
 * 3人の回答が揃って status が確定し、まだ本人が確認していない提案が対象。
 */
export function needsResultNoticeFor(
  proposal: Pick<
    SpecialEventProposal,
    'status' | 'proposerId' | 'resultSeenAt'
  >,
  userId: string,
): boolean {
  if (proposal.proposerId !== userId) return false;
  if (proposal.status === 'pending') return false;
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
  if (input.approverIds.length !== SPECIAL_EVENT_APPROVER_COUNT) {
    return `承認者を${SPECIAL_EVENT_APPROVER_COUNT}人選んでください`;
  }
  if (new Set(input.approverIds).size !== input.approverIds.length) {
    return '同じ人を複数選べません';
  }
  return null;
}
