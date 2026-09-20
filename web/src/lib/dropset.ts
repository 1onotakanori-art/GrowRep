// =====================================================================
// ドロップセットモードの判定ロジック（純粋関数）
//
// 同じ重量で 10回 → 8回 → 6回 をこなせたら、その重量を「クリア」とする。
// クリアできなければ「停滞」で、次回も同じ重量が提案される。
//
// ユーザーごとの「今の重量」はドキュメントを持たず、投稿から導出する
// （進捗ドキュメントを別に持つと投稿との同期ズレが必ず起きるため）。
// 詳細は dropset-mode-design.md を参照。
// =====================================================================
import type { DropsetExercise } from './types';

/** 目標回数。全種目共通で固定（設計 10.）。 */
export const TARGET_REPS: readonly number[] = [10, 8, 6];

/** クリア時の重量の刻み幅(kg)の既定値。種目ごとに変更できる。 */
export const DEFAULT_STEP = 2.5;

/** 種目を作るときの開始重量(kg)の既定値。 */
export const DEFAULT_START_WEIGHT = 20;

/** 入力を受け付ける重量の範囲(kg)。 */
export const MIN_WEIGHT = 0.5;
export const MAX_WEIGHT = 1000;

/** 種目に設定できる刻み幅(kg)の範囲。 */
export const MIN_STEP = 0.25;
export const MAX_STEP = 100;

/** 1セットあたりの回数の上限。 */
export const MAX_REPS = 999;

/** 集計に渡す挑戦記録。Firestore 型に依存させないための最小形。 */
export interface DropsetAttempt {
  userId: string;
  exerciseType: string;
  weight: number;
  reps: number[];
  target?: number[];
  cleared?: boolean;
  timestamp?: Date | null;
}

export interface DropsetProgress {
  /** クリア済みの最大重量。一度もクリアしていなければ null */
  clearedMax: number | null;
  /** 次に挑戦する重量（入力欄の初期値。ユーザーは書き換えられる） */
  suggestedWeight: number;
  /** 直近の挑戦（この種目の全重量を通じて最新の1件） */
  lastAttempt: DropsetAttempt | null;
  /** この種目の挑戦回数 */
  attempts: number;
  /** 提案重量で連続して失敗している回数 */
  stalledCount: number;
}

export interface DropsetRankRow {
  userId: string;
  /** クリア済み最大重量(kg) */
  weight: number;
  /** その重量をクリアした日時（同値のときの順位付けに使う） */
  clearedAt: Date | null;
}

export interface WeightPoint {
  /** クリアした日時（ミリ秒） */
  t: number;
  /** その時点でのクリア重量(kg) */
  weight: number;
}

/** 表示用の重量文字列。60 → "60"、62.5 → "62.5" */
export function formatWeight(weight: number): string {
  if (!isFinite(weight)) return '-';
  return Number(weight.toFixed(2)).toString();
}

/** 浮動小数の誤差を丸める（2.5 の加算を繰り返しても 62.50000000000001 にしない）。 */
function roundWeight(weight: number): number {
  return Math.round(weight * 100) / 100;
}

/**
 * 3セットすべて目標回数以上ならクリア。
 * セット数が目標より少ない（＝入力が足りない）場合は未クリア。
 */
export function isCleared(
  reps: number[] | undefined | null,
  target: readonly number[] = TARGET_REPS,
): boolean {
  if (!Array.isArray(reps) || reps.length < target.length) return false;
  return target.every((t, i) => Number(reps[i]) >= t);
}

/** 目標に届かなかったセットの「あと何回」。クリア済みなら空配列。 */
export function shortfallOf(
  reps: number[] | undefined | null,
  target: readonly number[] = TARGET_REPS,
): number[] {
  if (isCleared(reps, target)) return [];
  return target.map((t, i) => Math.max(0, t - Number(reps?.[i] ?? 0)));
}

function timeOf(a: { timestamp?: Date | null }): number {
  return a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
}

/** 新しい順（timestamp 未確定の投稿直後は最新扱い）。 */
function byNewest(a: DropsetAttempt, b: DropsetAttempt): number {
  const ta = timeOf(a) || Number.MAX_SAFE_INTEGER;
  const tb = timeOf(b) || Number.MAX_SAFE_INTEGER;
  return tb - ta;
}

function attemptCleared(a: DropsetAttempt): boolean {
  // cleared は保存済みの値を優先し、無ければ reps から再判定する
  return typeof a.cleared === 'boolean'
    ? a.cleared
    : isCleared(a.reps, a.target || TARGET_REPS);
}

/**
 * ある種目について、あるユーザーの進捗を投稿から導出する。
 *
 * - clearedMax: クリア済みの最大重量
 * - suggestedWeight: clearedMax + step（未クリアなら種目の startWeight）
 * - stalledCount: 提案重量で連続して失敗している回数
 */
export function progressOf(
  attempts: DropsetAttempt[],
  userId: string,
  exerciseKey: string,
  exercise?: Pick<DropsetExercise, 'startWeight' | 'step'> | null,
): DropsetProgress {
  const rawStep = Number(exercise?.step);
  const step = rawStep > 0 ? rawStep : DEFAULT_STEP;
  const rawStart = Number(exercise?.startWeight);
  const startWeight = rawStart > 0 ? rawStart : DEFAULT_START_WEIGHT;

  const mine = attempts
    .filter((a) => a.userId === userId && a.exerciseType === exerciseKey)
    .sort(byNewest);

  // ⚠️ forEach のコールバック内で代入すると、TypeScript の制御フロー解析が
  //    ループ後の clearedMax を null のままだと判断する。for-of で回すこと。
  let clearedMax: number | null = null;
  for (const a of mine) {
    if (!attemptCleared(a)) continue;
    const w = Number(a.weight);
    if (!isFinite(w)) continue;
    if (clearedMax === null || w > clearedMax) clearedMax = w;
  }

  const suggestedWeight =
    clearedMax == null ? startWeight : roundWeight(clearedMax + step);

  // 提案重量での連続失敗回数。間にクリアが挟まったらそこで止める
  let stalledCount = 0;
  for (const a of mine) {
    if (Number(a.weight) !== suggestedWeight) continue;
    if (attemptCleared(a)) break;
    stalledCount++;
  }

  return {
    clearedMax,
    suggestedWeight,
    lastAttempt: mine[0] || null,
    attempts: mine.length,
    stalledCount,
  };
}

/**
 * 種目ごとのランキング。クリア済み最大重量の絶対値で降順。
 * 同じ重量なら先に到達した人が上位。
 */
export function rankByClearedWeight(
  attempts: DropsetAttempt[],
  exerciseKey: string,
): DropsetRankRow[] {
  const best = new Map<string, DropsetRankRow>();

  attempts.forEach((a) => {
    if (a.exerciseType !== exerciseKey) return;
    if (!attemptCleared(a)) return;
    const w = Number(a.weight);
    if (!isFinite(w)) return;
    const at = a.timestamp instanceof Date ? a.timestamp : null;
    const cur = best.get(a.userId);
    if (!cur || w > cur.weight) {
      best.set(a.userId, { userId: a.userId, weight: w, clearedAt: at });
    } else if (w === cur.weight && at && cur.clearedAt && at < cur.clearedAt) {
      // 同じ重量を複数回クリアしている場合、最初に到達した日時を採用する
      best.set(a.userId, { userId: a.userId, weight: w, clearedAt: at });
    }
  });

  return [...best.values()].sort((x, y) => {
    if (y.weight !== x.weight) return y.weight - x.weight;
    const tx = x.clearedAt ? x.clearedAt.getTime() : Number.MAX_SAFE_INTEGER;
    const ty = y.clearedAt ? y.clearedAt.getTime() : Number.MAX_SAFE_INTEGER;
    return tx - ty;
  });
}

/**
 * 重量推移グラフ用の階段データ。
 * 「重量が更新された瞬間」だけを時系列で返す（停滞は階段に現れない）。
 */
export function weightHistory(
  attempts: DropsetAttempt[],
  userId: string,
  exerciseKey: string,
): WeightPoint[] {
  const cleared = attempts
    .filter(
      (a) =>
        a.userId === userId &&
        a.exerciseType === exerciseKey &&
        attemptCleared(a) &&
        isFinite(Number(a.weight)) &&
        timeOf(a) > 0,
    )
    .sort((a, b) => timeOf(a) - timeOf(b));

  const points: WeightPoint[] = [];
  let peak = -Infinity;
  cleared.forEach((a) => {
    const w = Number(a.weight);
    if (w <= peak) return; // 自己ベスト更新時だけ階段を刻む
    peak = w;
    points.push({ t: timeOf(a), weight: w });
  });
  return points;
}

// ---------------------------------------------------------------------
// 重量推移グラフ（階段）の座標計算
// 描画から切り離してテストできるよう、SVG のパス文字列までここで組み立てる。
// ---------------------------------------------------------------------

export interface ChartGeometry {
  width: number;
  height: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
}

export interface StepChartLayout {
  /** 各クリア点の描画座標 */
  points: { x: number; y: number; weight: number; t: number }[];
  /** 階段の折れ線 */
  linePath: string;
  /** 折れ線の下を塗るための閉パス */
  areaPath: string;
  /** Y軸の下限・上限（重量) */
  minV: number;
  maxV: number;
  /** 最初にクリアした重量と、現在の到達重量 */
  first: number;
  peak: number;
  /** 塗りの底辺 Y と、右端 X */
  baselineY: number;
  rightX: number;
  /** 期間（同一時刻しかない場合は 0） */
  tMin: number;
  tMax: number;
}

/**
 * 階段グラフのレイアウトを組む。
 * 重量は「次にクリアするまで据え置き」なので、折れ線ではなく
 * 「横に進む → クリアした日に垂直に上がる」階段で描く。
 * 点が無ければ null。
 */
export function buildStepChart(
  points: WeightPoint[],
  geom: ChartGeometry,
): StepChartLayout | null {
  const n = points.length;
  if (n === 0) return null;

  const { width, height, padL, padR, padT, padB } = geom;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const baselineY = height - padB;
  const rightX = width - padR;

  const first = points[0].weight;
  const peak = points[n - 1].weight;

  // 上下に余白を作り、線が枠に張り付かないようにする
  const span = peak - first;
  const pad = span > 0 ? span * 0.2 : Math.max(peak * 0.08, 2.5);
  const maxV = peak + pad;
  const minV = Math.max(0, first - pad);
  const range = maxV - minV || 1;

  // 時間軸。すべて同時刻（1点しかない等）のときは等間隔に逃がす
  const tMin = points[0].t;
  const tMax = points[n - 1].t;
  const spread = tMax - tMin;
  const xOf = (i: number) =>
    spread > 0
      ? padL + ((points[i].t - tMin) / spread) * innerW
      : padL + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yOf = (v: number) => padT + (1 - (v - minV) / range) * innerH;

  const scaled = points.map((p, i) => ({
    x: xOf(i),
    y: yOf(p.weight),
    weight: p.weight,
    t: p.t,
  }));

  let linePath = `M ${scaled[0].x} ${scaled[0].y}`;
  for (let i = 1; i < n; i++) {
    // 前の重量を保ったまま横へ → その日に垂直に上がる
    linePath += ` L ${scaled[i].x} ${scaled[i - 1].y} L ${scaled[i].x} ${scaled[i].y}`;
  }
  // 現在の重量を右端まで伸ばす（＝今この重量にいる）
  linePath += ` L ${rightX} ${scaled[n - 1].y}`;

  const areaPath =
    `M ${scaled[0].x} ${baselineY} ` +
    linePath.replace(/^M /, 'L ') +
    ` L ${rightX} ${baselineY} Z`;

  return {
    points: scaled,
    linePath,
    areaPath,
    minV,
    maxV,
    first,
    peak,
    baselineY,
    rightX,
    tMin,
    tMax,
  };
}

/** 入力値の検証。問題があればエラーメッセージ、無ければ null。 */
export function validateAttempt(
  weight: number,
  reps: number[],
): string | null {
  if (!isFinite(weight) || weight < MIN_WEIGHT || weight > MAX_WEIGHT) {
    return `重量は ${MIN_WEIGHT}〜${MAX_WEIGHT}kg で入力してください`;
  }
  if (reps.length !== TARGET_REPS.length) {
    return `${TARGET_REPS.length}セット分の回数を入力してください`;
  }
  for (const r of reps) {
    if (!isFinite(r) || r < 0 || r > MAX_REPS || Math.floor(r) !== r) {
      return `回数は 0〜${MAX_REPS} の整数で入力してください`;
    }
  }
  return null;
}
