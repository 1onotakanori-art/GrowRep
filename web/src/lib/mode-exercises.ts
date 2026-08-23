// モードに応じた投稿可能な種目リストを解決するヘルパー
import { getActiveWeeklyKeys } from './time-jst';
import type { DailyMissionState } from './daily-mission';
import type { FreeExercise, FreeExerciseMap, Mode, WeeklyChallenge } from './types';

/**
 * ロックの理由。
 * - 'reveal': 水曜13:00まで伏せられている4種目目（種目名も隠す）
 * - 'daily': その日のデイリーミッションが未クリア（種目名は見せる）
 */
export type PostLockReason = 'reveal' | 'daily';

export interface PostableExercise {
  key: string;
  ex: FreeExercise;
  locked?: boolean; // 週間の投稿不可枠
  lockReason?: PostLockReason;
}

/**
 * 週間チャレンジの投稿が「その日のデイリーミッション未クリア」でロックされているか。
 *
 * ⚠️ 判定できないときは必ず false（＝投稿できる）を返す。読み込み前や取得失敗で
 *    ロックしてしまうと、クリア済みの人まで投稿できなくなるため。
 * - ミッション自体が無い日（レイド前メンテナンス）はロックしない
 * - レイド開催日の cleared は「今日1回でも積んだか」なので、そのまま条件に使う
 */
export function isWeeklyPostLockedByDailyMission(
  dailyMission: DailyMissionState | null | undefined,
): boolean {
  if (!dailyMission) return false;
  if (dailyMission.maintenance) return false;
  return !dailyMission.cleared;
}

/**
 * 投稿タブ/ルールで表示する種目一覧をモード別に返す。
 * - free: 全種目
 * - weekly: 今週の種目。4種目目は水曜13:00まで locked（？？？）で表示。
 *   さらに、その日のデイリーミッションが未クリアなら解禁済みの枠もロックする。
 */
export function getModeExercises(
  mode: Mode,
  freeExercises: FreeExerciseMap,
  weeklyChallenge: WeeklyChallenge | null,
  now: Date = new Date(),
  dailyMission: DailyMissionState | null = null,
): PostableExercise[] {
  if (mode === 'free') {
    return Object.entries(freeExercises).map(([key, ex]) => ({ key, ex }));
  }
  // weekly
  if (!weeklyChallenge || weeklyChallenge.exercises.length === 0) return [];
  const all = weeklyChallenge.exercises;
  const active = new Set(getActiveWeeklyKeys(all, now));
  const dailyLocked = isWeeklyPostLockedByDailyMission(dailyMission);
  return all
    .filter((key) => freeExercises[key])
    .map((key) => {
      // 未解禁枠は種目名ごと伏せるので、デイリーのロックより優先する
      const reason: PostLockReason | undefined = !active.has(key)
        ? 'reveal'
        : dailyLocked
          ? 'daily'
          : undefined;
      return {
        key,
        ex: freeExercises[key],
        locked: reason !== undefined,
        lockReason: reason,
      };
    });
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
