// モードに応じた投稿可能な種目リストを解決するヘルパー
import { getActiveWeeklyKeys } from './time-jst';
import type { FreeExercise, FreeExerciseMap, Mode, WeeklyChallenge } from './types';

export interface PostableExercise {
  key: string;
  ex: FreeExercise;
  locked?: boolean; // 週間の未解禁枠（？？？）
}

/**
 * 投稿タブ/ルールで表示する種目一覧をモード別に返す。
 * - free: 全種目
 * - weekly: 今週の種目。4種目目は水曜13:00まで locked（？？？）で表示。
 */
export function getModeExercises(
  mode: Mode,
  freeExercises: FreeExerciseMap,
  weeklyChallenge: WeeklyChallenge | null,
  now: Date = new Date(),
): PostableExercise[] {
  if (mode === 'free') {
    return Object.entries(freeExercises).map(([key, ex]) => ({ key, ex }));
  }
  // weekly
  if (!weeklyChallenge || weeklyChallenge.exercises.length === 0) return [];
  const all = weeklyChallenge.exercises;
  const active = new Set(getActiveWeeklyKeys(all, now));
  return all
    .filter((key) => freeExercises[key])
    .map((key) => ({
      key,
      ex: freeExercises[key],
      locked: !active.has(key),
    }));
}

/** 週間で ？？？ プレースホルダとして表示する未解禁枠の数。 */
export function lockedWeeklyCount(
  weeklyChallenge: WeeklyChallenge | null,
  now: Date = new Date(),
): number {
  if (!weeklyChallenge) return 0;
  const all = weeklyChallenge.exercises;
  const active = getActiveWeeklyKeys(all, now);
  return Math.max(0, all.length - active.length);
}
