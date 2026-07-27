// =====================================================================
// デイリーミッション 選出・目標回数ロジック（純粋関数）
// ⚠️ 既存 app.js の同名関数のミラー。両アプリが同じ Firestore の
//    settings_free/daily_mission を共有し、目標回数はシードから
//    各自で再計算する。日付キー・シード文字列・分布定数を変更しないこと。
//    Firestore アクセスは daily-mission-engine.ts 側にある。
// =====================================================================
import type { FreeExerciseMap } from './types';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 直近何日分の種目を再選出から避けるか。 */
export const DAILY_RECENT_AVOID = 5;

// 目標回数の分布パラメータ（対数正規。ただし log 空間で上下の σ を変えられる）。
// σ上 = σ下 なら純粋な対数正規そのもので、右に裾を引く形はそのまま。
// σ上を少し小さくしてあるのは、飛び抜けて多い回数を引いたときの絶望を減らすため。
// σ は倍率に対する広がりなのでピーク回数によらず一定（対数正規のスケール不変性）。
export const DAILY_SIGMA_LOW = 0.34;
export const DAILY_SIGMA_HIGH = 0.26;
/** 抽選結果を丸め込む範囲（ピーク比）。 */
export const DAILY_MIN_RATIO = 0.45;
export const DAILY_MAX_RATIO = 2.0;
/** 何があっても下回らない回数。 */
export const DAILY_REPS_FLOOR = 5;
/** 過去に投稿が無い種目のピーク回数。 */
export const DAILY_REPS_DEFAULT_PEAK = 30;
/** 投稿がある種目のピーク＝過去最高回数のこの割合。 */
export const DAILY_PEAK_BEST_RATIO = 0.5;

/** ピーク回数の決まり方。best = 過去最高の半分 / default = 投稿が無いので既定値 */
export type DailyPeakSource = 'best' | 'default';

export interface DailyMission {
  dateKey: string;
  exerciseKey: string;
  /** その日の分布のピーク回数（全ユーザー共通） */
  peak: number;
  /** ピークの根拠になった過去最高回数（投稿が無ければ 0） */
  bestValue: number;
  peakSource: DailyPeakSource;
}

export interface DailyMissionState {
  dateKey: string;
  exerciseKey: string;
  target: number;
  cleared: boolean;
  /** その日に投稿した回数の合計（1回で達成しなくても積み上げられる） */
  totalValue: number;
  /** 自分の目標を引く確率（0〜1） */
  probability: number;
  peak: number;
  bestValue: number;
  peakSource: DailyPeakSource;
  /** その日にログインしたユーザーの目標と達成状況（分布グラフ用） */
  participants: DailyParticipant[];
}

export interface DailyParticipant {
  userId: string;
  userName: string;
  target: number;
  /** その目標回数を引く確率（0〜1） */
  probability: number;
  /** その日の合計回数 */
  totalValue: number;
  cleared: boolean;
  isMe: boolean;
}

// ---------------------------------------------------------------------
// 日付キー（JST 0:00 区切り）
// ---------------------------------------------------------------------

/** JST の暦日を YYYY-MM-DD で返す。app.js: getDailyDateKeyJST */
export function getDailyDateKeyJST(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 日付キーに対応する UTC の 1 日境界。app.js: getDailyBoundariesJST */
export function getDailyBoundariesJST(dateKey: string): {
  start: Date;
  end: Date;
} {
  const [y, m, d] = dateKey.split('-').map(Number);
  const startJstMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const start = new Date(startJstMs - JST_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// ---------------------------------------------------------------------
// シード付き乱数（同じ入力なら常に同じ結果）
// ---------------------------------------------------------------------

/** FNV-1a 32bit ハッシュ。app.js: hashStringToSeed */
export function hashStringToSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG。app.js: createSeededRandom */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller 法で標準正規乱数。app.js: seededNormal */
export function seededNormal(rand: () => number): number {
  // u1 = 0 だと log が -Infinity になるため下限を入れる
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ---------------------------------------------------------------------
// 目標回数（ユーザーごとにバラバラ）
// ---------------------------------------------------------------------

/**
 * その種目の過去最高回数からピーク回数を決める。
 * 投稿が一度も無い種目は既定値（30）。app.js: resolveDailyPeak
 */
export function resolveDailyPeak(bestValue: number): number {
  const best = Number(bestValue) || 0;
  if (best <= 0) return DAILY_REPS_DEFAULT_PEAK;
  return Math.max(DAILY_REPS_FLOOR, Math.round(best * DAILY_PEAK_BEST_RATIO));
}

/**
 * log 空間での分布の中心。最頻値がちょうど peak になるよう σ下² だけ右にずらす
 * （対数正規の最頻値 = exp(μ - σ²)）。app.js: dailyLogCenter
 */
export function dailyLogCenter(peak: number): number {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  return Math.log(p) + DAILY_SIGMA_LOW * DAILY_SIGMA_LOW;
}

/** 下側に振れる確率（＝密度が繋がるための面積比）。app.js: DAILY_LOW_WEIGHT */
export const DAILY_LOW_WEIGHT =
  DAILY_SIGMA_LOW / (DAILY_SIGMA_LOW + DAILY_SIGMA_HIGH);

/** 目標回数が取りうる範囲。app.js: dailyRepsBounds */
export function dailyRepsBounds(peak: number): { min: number; max: number } {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const min = Math.max(DAILY_REPS_FLOOR, Math.round(p * DAILY_MIN_RATIO));
  const max = Math.max(min + 1, Math.round(p * DAILY_MAX_RATIO));
  return { min, max };
}

/**
 * ユーザー×日付×種目で決まる目標回数。ピークを最頻値に右へ裾を引く対数正規で、
 * 上側の σ だけ小さくして大きい数字を出にくくしてある。
 * シードから毎回同じ値を再計算できるため保存不要（リロードしても変わらない）。
 * app.js: generateDailyMissionTarget
 */
export function generateDailyMissionTarget(
  userId: string,
  dateKey: string,
  exerciseKey: string,
  peak: number = DAILY_REPS_DEFAULT_PEAK,
): number {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const rand = createSeededRandom(
    hashStringToSeed(`daily-reps|${userId}|${dateKey}|${exerciseKey}`),
  );
  const center = dailyLogCenter(p);
  // どちら側に振れるかは面積比（σ下:σ上）で決める＝境目で密度が繋がる
  const side = rand();
  const z = Math.abs(seededNormal(rand));
  const y =
    side < DAILY_LOW_WEIGHT
      ? center - DAILY_SIGMA_LOW * z
      : center + DAILY_SIGMA_HIGH * z;
  const { min, max } = dailyRepsBounds(p);
  return Math.min(max, Math.max(min, Math.round(Math.exp(y))));
}

// ---------------------------------------------------------------------
// 当日の集計
// ---------------------------------------------------------------------

/**
 * 当日の投稿から userId→合計回数 を作る。
 * デイリーミッションは「その日に取り組んだ回数の合計」で達成を判定するので、
 * 週間チャレンジ（ベスト記録）とは違い最大値ではなく足し上げる。
 * app.js: sumDailyTotals
 */
export function sumDailyTotals(
  posts: Array<{ userId: string; exerciseType: string; value: number }>,
  exerciseKey: string,
): Record<string, number> {
  const totals: Record<string, number> = {};
  (posts || []).forEach((post) => {
    if (!post || post.exerciseType !== exerciseKey) return;
    const v = Number(post.value) || 0;
    if (v <= 0) return;
    totals[post.userId] = (totals[post.userId] || 0) + v;
  });
  return totals;
}

// ---------------------------------------------------------------------
// 種目の選出（全ユーザー共通）
// ---------------------------------------------------------------------

/** バーバリアン以外のフリー種目キー（安定ソート済み）。app.js: getDailyMissionCandidates */
export function getDailyMissionCandidates(
  freeExercises: FreeExerciseMap,
): string[] {
  return Object.keys(freeExercises || {})
    .filter((key) => freeExercises[key] && !freeExercises[key].barbarian)
    .sort();
}

/**
 * その日の種目を決定。日付キーのみをシードにするので、複数クライアントが
 * 同時に生成しても（候補が同じなら）同じ種目になる。
 * app.js: pickDailyMissionExercise
 */
export function pickDailyMissionExercise(
  dateKey: string,
  freeExercises: FreeExerciseMap,
  recentKeys: string[] = [],
): string | null {
  const candidates = getDailyMissionCandidates(freeExercises);
  if (candidates.length === 0) return null;

  const avoid = new Set(recentKeys);
  let pool = candidates.filter((key) => !avoid.has(key));
  if (pool.length === 0) pool = candidates;

  const rand = createSeededRandom(hashStringToSeed(`daily-mission|${dateKey}`));
  const idx = Math.min(pool.length - 1, Math.floor(rand() * pool.length));
  return pool[idx];
}

/** 直近履歴の更新（非破壊・先頭が最新）。app.js: pushRecentMissionKeys */
export function pushRecentMissionKeys(
  recentKeys: string[],
  exerciseKey: string,
): string[] {
  return [exerciseKey, ...(recentKeys || []).filter((k) => k !== exerciseKey)].slice(
    0,
    DAILY_RECENT_AVOID,
  );
}

// ---------------------------------------------------------------------
// 分布グラフ（みんなの目標を1枚に並べる）
// ---------------------------------------------------------------------

/**
 * 目標回数の確率密度（対数正規。中心より上だけ σ が小さい）。
 * 最頻値はちょうどピークで、amp を掛けているので全区間の積分が 1 になる。
 * 目標は保存せずシードから再計算できるので、他ユーザーの回数も
 * Firestore を読まずに全員分ローカルで求められる。app.js: dailyTargetPdf
 */
export function dailyTargetPdf(x: number, peak: number): number {
  if (!(x > 0)) return 0;
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const center = dailyLogCenter(p);
  const d = Math.log(x) - center;
  const s = d < 0 ? DAILY_SIGMA_LOW : DAILY_SIGMA_HIGH;
  const amp = Math.sqrt(2 / Math.PI) / (DAILY_SIGMA_LOW + DAILY_SIGMA_HIGH);
  return (amp / x) * Math.exp(-(d * d) / (2 * s * s));
}

/** 標準正規分布の累積分布。誤差関数は Abramowitz-Stegun 7.1.26 近似。 */
function standardNormalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const a = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * a);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
    t;
  const erf = 1 - poly * Math.exp(-a * a);
  return 0.5 * (1 + sign * erf);
}

/** 目標回数の累積分布（丸め前の連続値ベース）。app.js: dailyTargetCdf */
export function dailyTargetCdf(x: number, peak: number): number {
  if (!(x > 0)) return 0;
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const d = Math.log(x) - dailyLogCenter(p);
  if (d <= 0) return 2 * DAILY_LOW_WEIGHT * standardNormalCdf(d / DAILY_SIGMA_LOW);
  return (
    DAILY_LOW_WEIGHT +
    2 *
      (1 - DAILY_LOW_WEIGHT) *
      (standardNormalCdf(d / DAILY_SIGMA_HIGH) - 0.5)
  );
}

/**
 * その目標回数を引く確率。丸めた結果がその整数になる幅（±0.5）の面積で、
 * 上下限はそこへ丸め込まれる裾ぶんも含める（合計するとちょうど 1 になる）。
 * app.js: dailyTargetProbability
 */
export function dailyTargetProbability(target: number, peak: number): number {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const { min, max } = dailyRepsBounds(p);
  let prob: number;
  if (target <= min) prob = dailyTargetCdf(min + 0.5, p);
  else if (target >= max) prob = 1 - dailyTargetCdf(max - 0.5, p);
  else prob = dailyTargetCdf(target + 0.5, p) - dailyTargetCdf(target - 0.5, p);
  return Math.min(1, Math.max(0, prob));
}

/** 確率をラベル用の短い文字列に。app.js: formatDailyProbability */
export function formatDailyProbability(probability: number): string {
  const pct = (Number(probability) || 0) * 100;
  if (pct <= 0) return '0%';
  if (pct < 0.1) return '<0.1%';
  return `${pct.toFixed(1)}%`;
}

/**
 * 分布カーブの点列。y はピークが 1 になるよう正規化する。
 * app.js: buildDailyDistributionCurve
 */
export function buildDailyDistributionCurve(
  xMin: number,
  xMax: number,
  peak: number,
  steps = 96,
): Array<{ x: number; y: number }> {
  const top = dailyTargetPdf(peak, peak);
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const x = xMin + ((xMax - xMin) * i) / steps;
    points.push({ x, y: top > 0 ? dailyTargetPdf(x, peak) / top : 0 });
  }
  return points;
}

/**
 * その日のグラフに載せるユーザーか。今日ログインした人だけを対象にし、
 * 自分と「今日すでに投稿した人」は lastActiveDateKey の書き込み有無に
 * 関わらず必ず含める。app.js: isDailyActiveUser
 */
export function isDailyActiveUser(
  user: { lastActiveDateKey?: string } | undefined,
  userId: string,
  dateKey: string,
  totals: Record<string, number>,
  myUserId: string,
): boolean {
  if (userId === myUserId) return true;
  if ((totals[userId] || 0) > 0) return true;
  return (user || {}).lastActiveDateKey === dateKey;
}

export interface BuildDailyParticipantsInput {
  usersMap: Record<
    string,
    { userName?: string; email?: string; lastActiveDateKey?: string }
  >;
  dateKey: string;
  exerciseKey: string;
  /** 当日の投稿から作った userId→合計回数 */
  totals: Record<string, number>;
  myUserId: string;
  peak: number;
}

/**
 * その日ログインしたユーザーの目標を算出して並べる（目標が小さい順）。
 * app.js: buildDailyParticipants
 */
export function buildDailyParticipants({
  usersMap,
  dateKey,
  exerciseKey,
  totals,
  myUserId,
  peak,
}: BuildDailyParticipantsInput): DailyParticipant[] {
  return Object.keys(usersMap || {})
    .filter((userId) =>
      isDailyActiveUser(usersMap[userId], userId, dateKey, totals, myUserId),
    )
    .map((userId) => {
      const u = usersMap[userId] || {};
      const target = generateDailyMissionTarget(
        userId,
        dateKey,
        exerciseKey,
        peak,
      );
      const totalValue = totals[userId] || 0;
      return {
        userId,
        userName: u.userName || u.email || '名無しさん',
        target,
        probability: dailyTargetProbability(target, peak),
        totalValue,
        cleared: totalValue >= target,
        isMe: userId === myUserId,
      };
    })
    .sort((a, b) => a.target - b.target || a.userId.localeCompare(b.userId));
}

/** グラフ上のラベルで表示する名前の最大文字数（長い名前は省略する）。 */
export const DAILY_LABEL_NAME_MAX = 6;

/** 長い表示名を省略。app.js: truncateLabelName */
export function truncateLabelName(
  name: string,
  max = DAILY_LABEL_NAME_MAX,
): string {
  const n = name || '';
  return n.length > max ? n.slice(0, max) + '…' : n;
}

/**
 * ラベルが重ならないように段（レーン）へ割り当てる。
 * 位置の昇順に、その段の右端と実際の幅で衝突判定し、空いている最小の段へ置く。
 * どの段にも入らなければ新しい段を開く（= 段さえ増やせば必ず重ならない）。
 * app.js: assignLabelLanes
 * @param positions 各ラベルの中心x（昇順である必要はない）
 * @param widths 各ラベルの幅（positions と同じ並び）
 * @param maxLanes 段の上限。これを超える場合だけ最も余裕のある段に相乗りする
 * @param gap ラベル間に空ける最小の余白
 * @returns 入力順に対応した段番号
 */
export function assignLabelLanes(
  positions: number[],
  widths: number[],
  maxLanes = 8,
  gap = 4,
): number[] {
  const order = positions
    .map((x, i) => ({ x, i }))
    .sort((a, b) => a.x - b.x || a.i - b.i);
  const laneRight: number[] = [];
  const lanes = new Array<number>(positions.length).fill(0);

  order.forEach(({ x, i }) => {
    const half = (widths[i] || 0) / 2;
    const left = x - half;

    let lane = 0;
    for (; lane < laneRight.length; lane++) {
      if (left >= laneRight[lane] + gap) break;
    }
    if (lane === laneRight.length && laneRight.length >= maxLanes) {
      // 段を増やせないので最も右端が手前の段へ（この場合だけ重なりうる）
      lane = 0;
      for (let l = 1; l < laneRight.length; l++) {
        if (laneRight[l] < laneRight[lane]) lane = l;
      }
    }
    laneRight[lane] = x + half;
    lanes[i] = lane;
  });
  return lanes;
}

/** 使用された段数（= 最大段番号+1）。app.js: usedLaneCount */
export function usedLaneCount(lanes: number[]): number {
  return lanes.length === 0 ? 0 : Math.max(...lanes) + 1;
}

// ---------------------------------------------------------------------
// 表示ヘルパー
// ---------------------------------------------------------------------

/** 種目名から単位を推測（種目データに単位情報がないため）。app.js: guessExerciseUnit */
export function guessExerciseUnit(exerciseName: string): string {
  const name = exerciseName || '';
  if (name.includes('秒')) return '秒';
  if (name.includes('セット')) return 'セット';
  if (name.includes('分')) return '分';
  return '回';
}

/** 日付キーを「7/26(日)」形式に。app.js: formatDailyDateLabel */
export function formatDailyDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}(${dayNames[dow]})`;
}
