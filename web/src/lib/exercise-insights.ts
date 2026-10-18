// =====================================================================
// 種目まとめ（ダッシュボード・クリエイターランキング・選出確率）— 純粋ロジック
//
// 旧版 exercises.html の移植。Firestore の読み込みは exercise-insights-engine.ts。
// 選出確率だけは旧版の簡易式（選出回数と評価だけの重み）をやめ、
// 実際の抽選関数 selectWeeklyExercisesWithBarbarianSlot を何千回も回して数える。
// 2段階抽選（作成者→種目）・タイムアタック枠・週間対象外・作成者評価まで
// 本番と同じ条件で効くので、表示と実際の抽選がずれない。
// =====================================================================
import { selectWeeklyExercisesWithBarbarianSlot } from './weekly-select';
import type {
  ExerciseRatingSummary,
  FreeExerciseMap,
  UserData,
  WeeklyConfig,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PostStat {
  /** 累計投稿数 */
  total: number;
  /** 直近7日の投稿数 */
  recent7: number;
  /** その前の7日（8〜14日前）の投稿数 */
  prev7: number;
}

/** 種目ごとの投稿数（累計・直近7日・その前の7日）。旧版 loadAll の集計 */
export function computePostStats(
  posts: { exerciseType: string; timestamp: Date | null }[],
  now: Date = new Date(),
): Record<string, PostStat> {
  const out: Record<string, PostStat> = {};
  const nowMs = now.getTime();
  for (const p of posts) {
    const key = p.exerciseType;
    if (!key) continue;
    const s = (out[key] ||= { total: 0, recent7: 0, prev7: 0 });
    s.total++;
    if (!p.timestamp) continue;
    const age = nowMs - p.timestamp.getTime();
    if (age < 0) continue;
    if (age < 7 * DAY_MS) s.recent7++;
    else if (age < 14 * DAY_MS) s.prev7++;
  }
  return out;
}

export interface RankedItem {
  key: string;
  value: number;
}

const DASH_TOP = 5;

/** 急増中: 直近7日 − その前の7日 の大きい順（同点は直近7日の多い順） */
export function trendingExercises(
  stats: Record<string, PostStat>,
  keys: string[],
  n = DASH_TOP,
): RankedItem[] {
  return keys
    .filter((k) => (stats[k]?.total || 0) > 0)
    .map((k) => ({
      key: k,
      value: stats[k].recent7 - stats[k].prev7,
      recent: stats[k].recent7,
    }))
    .sort((a, b) => b.value - a.value || b.recent - a.recent)
    .slice(0, n)
    .map(({ key, value }) => ({ key, value }));
}

/** 人気: 累計投稿数の多い順 */
export function popularExercises(
  stats: Record<string, PostStat>,
  keys: string[],
  n = DASH_TOP,
): RankedItem[] {
  return keys
    .filter((k) => (stats[k]?.total || 0) > 0)
    .map((k) => ({ key: k, value: stats[k].total }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/** 高評価: 平均評価の高い順（評価 minCount 件以上の種目だけ） */
export function topRatedExercises(
  ratings: Record<string, ExerciseRatingSummary | null | undefined>,
  keys: string[],
  minCount = 3,
  n = DASH_TOP,
): RankedItem[] {
  return keys
    .filter((k) => (ratings[k]?.ratingCount || 0) >= minCount)
    .map((k) => ({ key: k, value: ratings[k]!.avgRating || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

// ---------------------------------------------------------------------
// 選出確率（モンテカルロ）
// ---------------------------------------------------------------------

/** 再現できる乱数（mulberry32）。同じ入力なら毎回同じ推定値になる */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * fn の実行中だけ Math.random を固定シードの乱数に差し替える。
 * 抽選関数は本番と同じものを使いたい（引数で乱数を渡せない）ので、
 * 同期処理の間だけ差し替えて finally で必ず戻す。
 */
function withSeededRandom<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  Math.random = createRng(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

export interface SelectionInput {
  exercises: FreeExerciseMap;
  /** settings_free/weekly_challenge.selectionHistory */
  history: Record<string, number>;
  /** settings_free/weekly_challenge.creatorSelectionHistory */
  creatorHistory: Record<string, number>;
  ratings: Record<string, ExerciseRatingSummary | null | undefined>;
  /** uid → users ドキュメント（作成者評価） */
  creators: Record<string, UserData | null | undefined>;
  config: Pick<
    WeeklyConfig,
    'weightExponent' | 'fairnessMode' | 'normalCount' | 'barbarianCount' | 'exerciseCount'
  >;
}

export interface SelectionEstimate {
  /** 次の選出で選ばれる確率（0〜1） */
  prob: number;
  /** 種目評価が無かった場合の確率（評価の効き目を見るため） */
  probWithoutRating: number;
}

/** 試行回数。2,000回で確率13%前後の誤差はおよそ±0.8pt。スマホで数百msに収まる */
export const SELECTION_TRIALS = 2000;

function runTrials(
  input: SelectionInput,
  ratings: SelectionInput['ratings'],
  trials: number,
  seed: number,
): Record<string, number> {
  const counts: Record<string, number> = {};
  const { config } = input;
  withSeededRandom(seed, () => {
    for (let i = 0; i < trials; i++) {
      const picked = selectWeeklyExercisesWithBarbarianSlot(
        input.exercises,
        input.history,
        config.weightExponent || 2,
        ratings as Record<string, ExerciseRatingSummary | null>,
        input.creators as Record<string, UserData | null>,
        {
          fairnessMode: config.fairnessMode || 'two_stage',
          creatorHistory: input.creatorHistory,
          normalCount: config.normalCount || 2,
          barbarianCount: config.barbarianCount || 1,
          revealCount: Math.max(0, (config.exerciseCount || 3) - 3),
        },
      );
      for (const k of picked) counts[k] = (counts[k] || 0) + 1;
    }
  });
  return counts;
}

/**
 * 各種目が「次の週間チャレンジで選ばれる確率」を、本番の抽選を trials 回
 * 回して推定する。週間対象外の種目は 0。
 * 評価なしの確率も同じシードで出し、評価で確率が上がった種目を見つけられるようにする。
 */
export function estimateSelectionProbabilities(
  input: SelectionInput,
  trials = SELECTION_TRIALS,
  seed = 20260101,
): Record<string, SelectionEstimate> {
  const keys = Object.keys(input.exercises);
  if (keys.length === 0 || trials <= 0) return {};
  const withRating = runTrials(input, input.ratings, trials, seed);
  const withoutRating = runTrials(input, {}, trials, seed);
  const out: Record<string, SelectionEstimate> = {};
  for (const k of keys) {
    out[k] = {
      prob: (withRating[k] || 0) / trials,
      probWithoutRating: (withoutRating[k] || 0) / trials,
    };
  }
  return out;
}

/** 評価で確率が上がった種目（上がり幅の大きい順）。value は上がった確率（0〜1） */
export function ratingBoostedExercises(
  estimates: Record<string, SelectionEstimate>,
  keys: string[],
  n = DASH_TOP,
  minBoost = 0.005,
): RankedItem[] {
  return keys
    .filter((k) => estimates[k])
    .map((k) => ({ key: k, value: estimates[k].prob - estimates[k].probWithoutRating }))
    .filter((x) => x.value >= minBoost)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/** 確率の表示（0.1%未満は「<0.1%」） */
export function formatProb(p: number): string {
  if (p <= 0) return '0%';
  if (p < 0.001) return '<0.1%';
  return `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
}

// ---------------------------------------------------------------------
// クリエイターランキング
// ---------------------------------------------------------------------

export type CreatorTier = 'excellent' | 'good' | 'bad';

export interface CreatorEntry {
  name: string;
  keys: string[];
  /** 評価のある種目の平均評価の平均。評価が1件も無ければ null */
  avgRating: number | null;
  ratedCount: number;
}

/** 復元時に入る仮の作成者名。ランキングから除く */
const RESTORED_CREATOR_NAME = '（復元）';

/** 作成者名ごとに種目をまとめ、平均評価の高い順（評価なしは末尾）。旧版 buildCreatorData */
export function buildCreatorRanking(
  exercises: FreeExerciseMap,
  ratings: Record<string, ExerciseRatingSummary | null | undefined>,
): CreatorEntry[] {
  const map = new Map<string, string[]>();
  for (const [key, ex] of Object.entries(exercises)) {
    const name = (ex as { createdByName?: string }).createdByName;
    if (!name || name === RESTORED_CREATOR_NAME) continue;
    const list = map.get(name) || [];
    list.push(key);
    map.set(name, list);
  }
  const out: CreatorEntry[] = [];
  for (const [name, keys] of map) {
    const rated = keys.filter((k) => ratings[k] && (ratings[k]!.ratingCount || 0) > 0);
    const avgRating = rated.length
      ? rated.reduce((s, k) => s + (ratings[k]!.avgRating || 0), 0) / rated.length
      : null;
    out.push({ name, keys, avgRating, ratedCount: rated.length });
  }
  return out.sort((a, b) => {
    if (a.avgRating == null && b.avgRating == null) return 0;
    if (a.avgRating == null) return 1;
    if (b.avgRating == null) return -1;
    return b.avgRating - a.avgRating;
  });
}

/** ★4以上=優良、3以上=良、3未満=要改善。評価なしは null */
export function creatorTier(avgRating: number | null): CreatorTier | null {
  if (avgRating == null) return null;
  if (avgRating >= 4) return 'excellent';
  if (avgRating >= 3) return 'good';
  return 'bad';
}
