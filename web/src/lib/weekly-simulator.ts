// =====================================================================
// 週間チャレンジの総合得点シミュレーター — 純粋ロジック
//
// ランキング（総合得点）で、各プレイヤーの記録を一時的に書き換えて
// 順位と得点がどう動くかを見る。書き換えは画面内だけで保存しない。
// 旧版 app.js の calculateWeeklySimulatedScores の移植。得点の付け方は
// scoring.ts の rescoreWeeklyRecords（本番の集計と同じ式）に任せる。
// =====================================================================
import { rankUsers, rescoreWeeklyRecords, type UserRecords } from './scoring';
import type { FreeExerciseMap } from './types';

/** userId → 種目キー → 仮の記録値 */
export type SimOverrides = Record<string, Record<string, number>>;

/**
 * 入力値を記録値として使える数に整える。
 * 負数は0、小数は第1位まで（タイムアタックの秒数を想定）。数でなければ fallback。
 */
export function clampSimValue(raw: unknown, fallback = 0): number {
  if (raw === '' || raw === null || raw === undefined) return fallback;
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.round(num * 10) / 10);
}

/**
 * 仮の記録を1件書き換えた新しい overrides を返す（元は変更しない）。
 * 実際の記録と同じ値に戻したら、その書き換えは消す。
 */
export function setSimOverride(
  overrides: SimOverrides,
  userId: string,
  exerciseKey: string,
  value: number,
  baseValue: number,
): SimOverrides {
  const next: SimOverrides = { ...overrides };
  const mine = { ...(next[userId] || {}) };
  if (value === baseValue) delete mine[exerciseKey];
  else mine[exerciseKey] = value;
  if (Object.keys(mine).length === 0) delete next[userId];
  else next[userId] = mine;
  return next;
}

/** 書き換え中の記録の件数 */
export function countSimOverrides(overrides: SimOverrides): number {
  return Object.values(overrides).reduce((n, m) => n + Object.keys(m).length, 0);
}

/**
 * 仮の記録で総合得点を計算し直したレコードを返す（base は変更しない）。
 * ストリーク（日数・加点）は投稿した日で決まるので base のまま。
 */
export function simulateWeeklyRecords(
  base: UserRecords,
  exerciseKeys: string[],
  freeExercises: FreeExerciseMap,
  overrides: SimOverrides,
): UserRecords {
  const out: UserRecords = {};
  for (const [userId, rec] of Object.entries(base)) {
    const exercises: Record<string, number> = { ...rec.exercises };
    for (const [key, value] of Object.entries(overrides[userId] || {})) {
      exercises[key] = value;
    }
    out[userId] = {
      userName: rec.userName,
      exercises,
      scores: {},
      totalScore: 0,
      streakDays: rec.streakDays || 0,
      streakBonus: rec.streakBonus || 0,
    };
  }
  rescoreWeeklyRecords(out, exerciseKeys, freeExercises);
  return out;
}

/**
 * 実際の順位から何位動いたか（上がったら正）。
 * 両方にいる userId だけを返す。
 */
export function rankMovement(
  actual: UserRecords,
  simulated: UserRecords,
): Record<string, number> {
  const before = new Map(rankUsers(actual).map((r) => [r.userId, r.rank]));
  const out: Record<string, number> = {};
  for (const r of rankUsers(simulated)) {
    const prev = before.get(r.userId);
    if (prev !== undefined) out[r.userId] = prev - r.rank;
  }
  return out;
}
