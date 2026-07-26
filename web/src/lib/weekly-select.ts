// =====================================================================
// 週間チャレンジ 種目抽選ロジック（純粋関数）
// ⚠️ 既存 app.js の同名関数のミラー。2段階公平抽選・バーバリアン枠・
//    水曜公開枠・評価係数の計算式を変更しないこと。
//    グローバル freeExercises への依存は allExercises 引数に置換している。
// =====================================================================
import type { FreeExerciseMap, ExerciseRatingSummary, UserData } from './types';

type RatingsMap = Record<string, ExerciseRatingSummary | null>;
type CreatorDataMap = Record<string, UserData | null>;

/** 種目評価から選出確率の修正係数。app.js: calcExerciseRatingModifier */
export function calcExerciseRatingModifier(
  summary: ExerciseRatingSummary | null,
): number {
  if (!summary || (summary.ratingCount || 0) < 3) return 1.0;
  const avg = summary.avgRating;
  if (avg <= 2) return 0.3;
  if (avg >= 4) return 2.0;
  if (avg < 3) return 0.3 + (avg - 2) * 0.7;
  return 1.0 + (avg - 3) * 1.0;
}

/** 作成者評価から選出確率の修正係数。app.js: calcCreatorRatingModifier */
export function calcCreatorRatingModifier(
  creatorData:
    | (UserData & {
        creatorRatedExerciseCount?: number;
        creatorAvgRating?: number;
      })
    | null,
): number {
  if (!creatorData) return 1.0;
  const count = creatorData.creatorRatedExerciseCount || 0;
  if (count < 3) return 1.0;
  const avg = creatorData.creatorAvgRating;
  if (avg == null) return 1.0;
  if (avg <= 2) return 0.6;
  if (avg >= 4) return 1.4;
  return 1.0;
}

/** 加重ランダムで count 個を選出。app.js: selectWeeklyExercises */
export function selectWeeklyExercises(
  allKeys: string[],
  history: Record<string, number>,
  count = 3,
  weightExponent = 2,
  exerciseRatings: RatingsMap = {},
  creatorData: CreatorDataMap = {},
  allExercises: FreeExerciseMap = {},
): string[] {
  if (allKeys.length <= count) return [...allKeys];

  const remaining = [...allKeys];
  const selected: string[] = [];

  for (let i = 0; i < count; i++) {
    const weights = remaining.map((key) => {
      const base = 1 / Math.pow((history[key] || 0) + 1, weightExponent);
      const exRating = calcExerciseRatingModifier(exerciseRatings[key] || null);
      const ex = allExercises[key];
      const creatorId = ex ? ex.createdBy : null;
      const crRating = calcCreatorRatingModifier(
        creatorId ? creatorData[creatorId] || null : null,
      );
      return Math.max(base * exRating * crRating, 1e-9);
    });
    const total = weights.reduce((s, w) => s + w, 0);

    let rand = Math.random() * total;
    for (let j = 0; j < remaining.length; j++) {
      rand -= weights[j];
      if (rand <= 0) {
        selected.push(remaining[j]);
        remaining.splice(j, 1);
        break;
      }
    }
  }
  return selected;
}

/** 種目の作成者ID（擬似含む）。app.js: getExerciseCreatorId */
export function getExerciseCreatorId(
  allExercises: FreeExerciseMap,
  key: string,
): string {
  const ex = allExercises && allExercises[key];
  return ex && ex.createdBy ? ex.createdBy : `__ex_${key}`;
}

/** 作成者選出回数を +1 した新マップ（非破壊）。app.js: incrementCreatorHistory */
export function incrementCreatorHistory(
  base: Record<string, number>,
  selectedKeys: string[],
  allExercises: FreeExerciseMap,
): Record<string, number> {
  const next = { ...(base || {}) };
  (selectedKeys || []).forEach((key) => {
    const cid = getExerciseCreatorId(allExercises, key);
    next[cid] = (next[cid] || 0) + 1;
  });
  return next;
}

/** 重み配列から加重ランダムで1件のインデックス。app.js: weightedPickIndex */
export function weightedPickIndex(weights: number[]): number {
  if (!weights.length) return -1;
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return weights.length - 1;
  let rand = Math.random() * total;
  for (let j = 0; j < weights.length; j++) {
    rand -= weights[j];
    if (rand <= 0) return j;
  }
  return weights.length - 1;
}

/** 2段階抽選（作成者→種目）。app.js: selectExercisesTwoStage */
export function selectExercisesTwoStage(
  candidateKeys: string[],
  allExercises: FreeExerciseMap,
  history: Record<string, number>,
  creatorHistory: Record<string, number>,
  count: number,
  weightExponent: number,
  exerciseRatings: RatingsMap,
  creatorData: CreatorDataMap,
  usedCreators: Set<string>,
): string[] {
  if (candidateKeys.length <= count) return [...candidateKeys];

  const byCreator: Record<string, string[]> = {};
  candidateKeys.forEach((key) => {
    const cid = getExerciseCreatorId(allExercises, key);
    (byCreator[cid] = byCreator[cid] || []).push(key);
  });

  const selected: string[] = [];
  for (let i = 0; i < count; i++) {
    let creatorIds = Object.keys(byCreator).filter(
      (cid) => byCreator[cid].length > 0 && !usedCreators.has(cid),
    );
    if (creatorIds.length === 0) {
      creatorIds = Object.keys(byCreator).filter(
        (cid) => byCreator[cid].length > 0,
      );
    }
    if (creatorIds.length === 0) break;

    const creatorWeights = creatorIds.map((cid) => {
      const base = 1 / Math.pow((creatorHistory[cid] || 0) + 1, weightExponent);
      const crRating = calcCreatorRatingModifier(creatorData[cid] || null);
      return Math.max(base * crRating, 1e-9);
    });
    const cIdx = weightedPickIndex(creatorWeights);
    const creatorId = creatorIds[cIdx];

    const keys = byCreator[creatorId];
    const keyWeights = keys.map((key) => {
      const base = 1 / Math.pow((history[key] || 0) + 1, weightExponent);
      const exRating = calcExerciseRatingModifier(exerciseRatings[key] || null);
      return Math.max(base * exRating, 1e-9);
    });
    const kIdx = weightedPickIndex(keyWeights);
    const chosen = keys[kIdx];

    selected.push(chosen);
    usedCreators.add(creatorId);
    byCreator[creatorId] = keys.filter((_, idx) => idx !== kIdx);
  }
  return selected;
}

export interface SelectionOptions {
  fairnessMode?: 'two_stage' | 'legacy';
  creatorHistory?: Record<string, number>;
  normalCount?: number;
  barbarianCount?: number;
  revealCount?: number;
}

/**
 * 「通常n種目 + バーバリアン1種目 (+水曜公開枠)」で選出。
 * app.js: selectWeeklyExercisesWithBarbarianSlot
 * 並び順: [基本normal..., barbarian, 水曜公開の追加normal...]
 */
export function selectWeeklyExercisesWithBarbarianSlot(
  allExercises: FreeExerciseMap,
  history: Record<string, number>,
  weightExponent = 2,
  exerciseRatings: RatingsMap = {},
  creatorData: CreatorDataMap = {},
  options: SelectionOptions = {},
): string[] {
  const {
    fairnessMode = 'two_stage',
    creatorHistory = {},
    normalCount = 2,
    barbarianCount = 1,
    revealCount = 0,
  } = options;
  const targetCount = normalCount + barbarianCount + revealCount;

  const allKeys = Object.keys(allExercises || {}).filter(
    (key) => !allExercises[key]?.excludeFromWeekly,
  );
  if (allKeys.length === 0) return [];

  const normalKeys = allKeys.filter(
    (key) => !(allExercises[key] && allExercises[key].barbarian),
  );
  const barbarianKeys = allKeys.filter(
    (key) => allExercises[key] && allExercises[key].barbarian,
  );

  const usedCreators = new Set<string>();
  const pick = (pool: string[], n: number) =>
    fairnessMode === 'legacy'
      ? selectWeeklyExercises(
          pool,
          history,
          n,
          weightExponent,
          exerciseRatings,
          creatorData,
          allExercises,
        )
      : selectExercisesTwoStage(
          pool,
          allExercises,
          history,
          creatorHistory,
          n,
          weightExponent,
          exerciseRatings,
          creatorData,
          usedCreators,
        );

  const selectedNormal = pick(normalKeys, normalCount);
  const selectedBarbarian = pick(barbarianKeys, barbarianCount);

  const ordered: string[] = [];
  const seen = new Set<string>();
  const pushUnique = (k: string) => {
    if (k && !seen.has(k)) {
      seen.add(k);
      ordered.push(k);
    }
  };
  selectedNormal.forEach(pushUnique);
  selectedBarbarian.forEach(pushUnique);

  if (revealCount > 0) {
    const remainingNormals = normalKeys.filter((key) => !seen.has(key));
    const revealPicks = pick(remainingNormals, revealCount);
    revealPicks.forEach(pushUnique);
  }

  if (ordered.length < targetCount) {
    const remainingKeys = allKeys.filter((key) => !seen.has(key));
    const fallback = selectWeeklyExercises(
      remainingKeys,
      history,
      targetCount - ordered.length,
      weightExponent,
      exerciseRatings,
      creatorData,
      allExercises,
    );
    fallback.forEach(pushUnique);
  }

  return ordered;
}
