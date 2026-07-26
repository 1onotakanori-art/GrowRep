// スコア読み込み（Firestore 取得 + 純粋集計関数の橋渡し）
import { getAllPosts, getWeeklyPosts } from './posts';
import { getUsersMap } from './users';
import {
  computeFreeScores,
  computeWeeklyScores,
  type PostInput,
  type UserRecords,
} from './scoring';
import { getActiveWeeklyKeys } from './time-jst';
import type {
  FreeExerciseMap,
  Post,
  WeeklyChallenge,
  WeeklyConfig,
} from './types';
import type { Timestamp } from 'firebase/firestore';

function toInput(posts: Post[]): PostInput[] {
  return posts.map((p) => ({
    userId: p.userId,
    exerciseType: p.exerciseType,
    value: Number(p.value) || 0,
    timestamp: (p.timestamp as Timestamp | null)?.toDate?.() || null,
  }));
}

async function usersNameMap(): Promise<Record<string, string>> {
  const map = await getUsersMap();
  const out: Record<string, string> = {};
  Object.keys(map).forEach((uid) => {
    out[uid] = map[uid].userName || map[uid].email || 'Unknown';
  });
  return out;
}

/** フリーモードの総合スコア。 */
export async function loadFreeScores(
  freeExercises: FreeExerciseMap,
): Promise<UserRecords> {
  const [posts, usersData] = await Promise.all([getAllPosts(), usersNameMap()]);
  return computeFreeScores(toInput(posts), freeExercises, usersData);
}

/** 週間モードの総合スコア（アクティブ種目のみ）。 */
export async function loadWeeklyScores(
  freeExercises: FreeExerciseMap,
  weeklyChallenge: WeeklyChallenge,
  weeklyConfig: WeeklyConfig,
): Promise<{ records: UserRecords; exerciseKeys: string[] }> {
  const { weekStart, weekEnd } = weeklyChallenge;
  const exerciseKeys = getActiveWeeklyKeys(weeklyChallenge.exercises).filter(
    (k) => freeExercises[k],
  );
  const [posts, usersData] = await Promise.all([
    getWeeklyPosts(weekStart, weekEnd),
    usersNameMap(),
  ]);
  const records = computeWeeklyScores(toInput(posts), freeExercises, usersData, {
    weekStart,
    weekEnd,
    exerciseKeys,
    weeklyConfig,
  });
  return { records, exerciseKeys };
}
