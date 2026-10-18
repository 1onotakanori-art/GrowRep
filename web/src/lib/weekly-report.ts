// =====================================================================
// ウィークリー（週報 + 分析ダッシュボード）— 純粋ロジック
//
// Firestore の読み込みは weekly-report-engine.ts。ここは firebase を
// import しないので、Vitest からそのまま検証できる。
//
// コレクション: weekly_reports/<exportDate>（例: 2026-06-07）
// analytics/publish-report.js がローカルPCのサービスアカウントで書き込む
// 「公式発表」。クライアントは読み取り専用（firestore.rules で write: false）。
// 旧版 report.js からの移植。digest の形は analytics/build-digest.js が正。
// =====================================================================

/** 最後に開いた週の docId を覚える localStorage キー（旧 index.html / report.html と共有） */
export const WEEKLY_REPORT_SEEN_KEY = 'growrep_lastSeenWeekly';
/** 週セレクタに出す最大件数（新しい順） */
export const WEEKLY_REPORT_LIST_LIMIT = 12;

export interface WeeklyReportSummaryItem {
  id: string;
  /** 対象週の表示名（例: 6/1〜6/5）。無ければ docId */
  coverPeriodLabel: string;
}

export interface WcExercise {
  name: string;
  barbarian?: boolean;
}
export interface WcPerExercise {
  value: number | null;
  score: number;
  isLeader?: boolean;
}
export interface WcStanding {
  rank: number;
  userName: string;
  totalScore: number;
  perExercise?: WcPerExercise[];
}
export interface WeeklyChallengeDigest {
  period?: { label?: string };
  exercises?: WcExercise[];
  standings?: WcStanding[];
  champion?: { userName: string; totalScore: number; perfect?: boolean } | null;
  maxScore?: number;
  leadMargin?: number | null;
}

export interface DerbyStanding {
  rank: number;
  userName: string;
  total: number;
  weeklyScores?: number[];
}
export interface MonthlyDerbyDigest {
  label?: string;
  monthOver?: boolean;
  leader?: { userName: string; total: number } | null;
  leadMargin?: number | null;
  weeks?: { weekNum: number; label?: string }[];
  standings?: DerbyStanding[];
}

export interface SummaryDigest {
  postsThisWeek: number;
  activeUsersThisWeek: number;
  hottestExercise?: string | null;
  mvp?: { userName: string; pbThisWeek: number; postsThisWeek: number } | null;
  totalPosts: number;
  activeUsers: number;
  totalUsers: number;
  totalExercises: number;
}

export interface UserBadge {
  label: string;
  desc: string;
  value?: number | string | null;
}
export interface RankedExercise {
  name: string;
  /** 0〜100。大きいほど上位 */
  percentile: number;
}
export interface GrowthExercise {
  name: string;
  relSlopeWeekPct: number;
}
export interface UserDigest {
  userName: string;
  type?: string | null;
  badges?: UserBadge[];
  totalPosts: number;
  activeDays: number;
  longestStreak: number;
  overallSkill?: number | null;
  social: {
    likesReceived: number;
    likesGiven: number;
    commentsReceived: number;
    commentsGiven: number;
  };
  /** タグ → 相対パーセンタイル（0〜100） */
  tagStrength?: Record<string, number>;
  strengths?: RankedExercise[];
  weaknesses?: RankedExercise[];
  growthStars?: GrowthExercise[];
  neglectedTags?: string[];
  /** 曜日別投稿数。0=日 … 6=土 */
  weekday?: number[];
}

export interface ExerciseDigest {
  name: string;
  tags?: string[];
  totalPosts: number;
  uniqueUsers: number;
  recent7: number;
  /** 直近7日 − その前の7日 */
  momentum: number;
  topUser?: string | null;
  rating?: { avg: number; count: number } | null;
  createdByName?: string | null;
}

export interface TagDigest {
  tag: string;
  exerciseCount: number;
  postCount: number;
  king?: { user: string; score: number } | null;
}

export interface RivalryDigest {
  exercise: string;
  leader: string;
  leaderValue: number;
  challenger: string;
  challengerValue: number;
  gapPct: number;
}

export interface WeeklyDigest {
  summary?: SummaryDigest;
  weeklyChallenge?: WeeklyChallengeDigest | null;
  monthlyDerby?: MonthlyDerbyDigest | null;
  users?: UserDigest[];
  exercises?: ExerciseDigest[];
  tags?: TagDigest[];
  rivalries?: RivalryDigest[];
}

export interface WeeklyReport {
  id: string;
  coverPeriodLabel: string;
  /** Cowork が書いた週報（marked で HTML 化済み） */
  reportHtml: string;
  /** { userName: ひとことMC } */
  memberNotes: Record<string, string>;
  digest: WeeklyDigest;
}

/** 最新の週を、まだ開いていなければ true */
export function isWeeklyReportUnseen(
  latestId: string | null,
  seenId: string | null,
): boolean {
  return !!latestId && latestId !== seenId;
}

/**
 * publishedAt で並べ替えられなかった時のフォールバック。
 * docId は exportDate（YYYY-MM-DD）なので文字列の降順＝新しい順。
 */
export function sortReportsByIdDesc<T extends { id: string }>(
  items: T[],
  max = WEEKLY_REPORT_LIST_LIMIT,
): T[] {
  return [...items].sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, max);
}

/** パーセンタイルの色分け。66以上=高、33以下=低 */
export function percentileClass(p: number): 'hi' | 'mid' | 'lo' {
  return p >= 66 ? 'hi' : p <= 33 ? 'lo' : 'mid';
}

/** パーセンタイル（大きいほど上位）→「上位n%」 */
export function topPercentLabel(percentile: number): string {
  return `上位${(100 - percentile).toFixed(0)}%`;
}

/** 二つ名・ペルソナカードの並び順。ここに無いものは末尾 */
export const PERSONA_ORDER = [
  '投稿王',
  '継続の鬼',
  '急成長株',
  '人気者',
  'いいね職人',
  'コメント番長',
  '種目クリエイター',
  '神種目メーカー',
  '万能型',
  '一点特化型',
  '朝型',
  '夜型',
];

export interface PersonaGroup {
  label: string;
  desc: string;
  holders: { user: string; value: number | string | null }[];
}

/** ユーザーごとの称号を「称号 → 保持者一覧」に組み替える */
export function groupPersonas(users: UserDigest[]): PersonaGroup[] {
  const map = new Map<string, PersonaGroup>();
  for (const u of users) {
    for (const b of u.badges || []) {
      let g = map.get(b.label);
      if (!g) {
        g = { label: b.label, desc: b.desc, holders: [] };
        map.set(b.label, g);
      }
      g.holders.push({ user: u.userName, value: b.value ?? null });
    }
  }
  const rank = (label: string) => {
    const i = PERSONA_ORDER.indexOf(label);
    return i === -1 ? PERSONA_ORDER.length : i;
  };
  return [...map.values()].sort((a, b) => rank(a.label) - rank(b.label));
}

/** カルテに出すのは1件以上投稿した人だけ */
export function activeReportUsers(users: UserDigest[]): UserDigest[] {
  return users.filter((u) => u.totalPosts > 0);
}

/** 勢い（momentum）の表示。▲n / ▼n / − */
export function momentumLabel(momentum: number): {
  text: string;
  dir: 'up' | 'down' | 'flat';
} {
  if (momentum > 0) return { text: `▲${momentum}`, dir: 'up' };
  if (momentum < 0) return { text: `▼${Math.abs(momentum)}`, dir: 'down' };
  return { text: '−', dir: 'flat' };
}

/** ライバル対決のバー幅（挑戦者 / 首位 の %）。0〜100 に収める */
export function rivalryRatio(r: Pick<RivalryDigest, 'leaderValue' | 'challengerValue'>): number {
  if (!(r.leaderValue > 0)) return 0;
  return Math.max(0, Math.min(100, (r.challengerValue / r.leaderValue) * 100));
}

/**
 * 週報 HTML の最低限の無害化。
 * 書き込みはサービスアカウントだけで publish 側でも同じ処理をしているが、
 * innerHTML で差し込むので表示側でも二重にかけておく。
 */
export function sanitizeReportHtml(html: string): string {
  return String(html || '')
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}

/** Firestore のドキュメントを画面用に整える（欠けたフィールドは空で埋める） */
export function toWeeklyReport(
  id: string,
  data: Record<string, unknown> | undefined,
): WeeklyReport {
  const d = data || {};
  const notes =
    d.memberNotes && typeof d.memberNotes === 'object'
      ? (d.memberNotes as Record<string, string>)
      : {};
  return {
    id,
    coverPeriodLabel:
      typeof d.coverPeriodLabel === 'string' && d.coverPeriodLabel
        ? d.coverPeriodLabel
        : id,
    reportHtml: sanitizeReportHtml(
      typeof d.reportHtml === 'string' ? d.reportHtml : '',
    ),
    memberNotes: notes,
    digest:
      d.digest && typeof d.digest === 'object'
        ? (d.digest as WeeklyDigest)
        : {},
  };
}
