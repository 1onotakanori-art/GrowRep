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

// 対数正規分布のパラメータ。最頻値（ピーク）= exp(MU - SIGMA^2) = 30 回。
export const DAILY_REPS_SIGMA = 0.45;
export const DAILY_REPS_PEAK = 30;
export const DAILY_REPS_MU =
  Math.log(DAILY_REPS_PEAK) + DAILY_REPS_SIGMA * DAILY_REPS_SIGMA;
export const DAILY_REPS_MIN = 8;
export const DAILY_REPS_MAX = 150;

export interface DailyMission {
  dateKey: string;
  exerciseKey: string;
}

export interface DailyMissionState {
  dateKey: string;
  exerciseKey: string;
  target: number;
  cleared: boolean;
  bestValue: number;
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
 * ユーザー×日付×種目で決まる目標回数。ピーク30回で右に裾を引く対数正規分布。
 * シードから毎回同じ値を再計算できるため保存不要（リロードしても変わらない）。
 * app.js: generateDailyMissionTarget
 */
export function generateDailyMissionTarget(
  userId: string,
  dateKey: string,
  exerciseKey: string,
): number {
  const rand = createSeededRandom(
    hashStringToSeed(`daily-reps|${userId}|${dateKey}|${exerciseKey}`),
  );
  const z = seededNormal(rand);
  const raw = Math.exp(DAILY_REPS_MU + DAILY_REPS_SIGMA * z);
  return Math.min(DAILY_REPS_MAX, Math.max(DAILY_REPS_MIN, Math.round(raw)));
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
