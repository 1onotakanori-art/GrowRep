// =====================================================================
// 得点計算ロジック（純粋関数）
// ⚠️ 既存 app.js の getAllUsersScoresFree / getAllUsersScoresWeekly の
//    集計部分のミラー。%換算・バーバリアン・下位3採用・ストリークの
//    計算式を変更しないこと（両アプリでランキングが一致する必要がある）。
// =====================================================================
import { isWeekdayJST, weekdayIndexJST } from './time-jst';
import type { FreeExerciseMap, WeeklyConfig } from './types';

export interface PostInput {
  userId: string;
  exerciseType: string;
  value: number;
  timestamp?: Date | null;
}

export interface UserRecord {
  userName: string;
  exercises: Record<string, number>; // 種目キー → ベスト記録値
  scores: Record<string, number>; // 種目キー → %スコア
  totalScore: number;
  streakDays?: number;
  streakBonus?: number;
  postedDays?: Set<number>;
}

export type UserRecords = Record<string, UserRecord>;

/** 偏差値。app.js: calculateDeviation */
export function calculateDeviation(
  score: number,
  mean: number,
  stdDev: number,
): number {
  if (stdDev === 0) return 50;
  return 50 + (10 * (score - mean)) / stdDev;
}

/**
 * 下位 keep 件のみ採用して合計。4種目以上のとき自分の最高%を1つ切り捨てる。
 * app.js: sumAdoptedScores
 */
export function sumAdoptedScores(scoreValues: number[], keep = 3): number {
  const vals = (scoreValues || []).map((v) =>
    typeof v === 'number' && isFinite(v) ? v : 0,
  );
  if (vals.length <= keep) return vals.reduce((s, v) => s + v, 0);
  const asc = [...vals].sort((a, b) => a - b);
  return asc.slice(0, keep).reduce((s, v) => s + v, 0);
}

/** 平日インデックス集合から最長連続日数。app.js: longestConsecutiveDays */
export function longestConsecutiveDays(
  indices: Set<number> | number[],
): number {
  const set = indices instanceof Set ? indices : new Set(indices || []);
  let best = 0;
  let run = 0;
  for (let i = 0; i <= 4; i++) {
    if (set.has(i)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

/** ストリーク加点。app.js: computeStreakBonus */
export function computeStreakBonus(
  streakDays: number,
  cfg: Partial<Pick<WeeklyConfig, 'streakBonusPerDay' | 'streakBonusCap'>> = {},
): number {
  const perDay = cfg.streakBonusPerDay != null ? cfg.streakBonusPerDay : 3;
  const cap = cfg.streakBonusCap != null ? cfg.streakBonusCap : 15;
  return Math.min(streakDays * perDay, cap);
}

/** 種目ごとにベスト記録を反映（バーバリアンは最小、通常は最大）。 */
function applyBest(
  rec: UserRecord,
  exerciseType: string,
  value: number,
  isBarbarian: boolean,
): void {
  if (isBarbarian) {
    if (
      rec.exercises[exerciseType] === undefined ||
      rec.exercises[exerciseType] > value
    ) {
      rec.exercises[exerciseType] = value;
    }
  } else {
    if (!rec.exercises[exerciseType] || rec.exercises[exerciseType] < value) {
      rec.exercises[exerciseType] = value;
    }
  }
}

/** 種目ごとの%スコアを計算して各ユーザーに書き込む。addToTotal で合計に加算するか制御。 */
function computePercentages(
  userRecords: UserRecords,
  exerciseKeys: string[],
  freeExercises: FreeExerciseMap,
  addToTotal: boolean,
): void {
  exerciseKeys.forEach((exercise) => {
    const isBarbarian = !!(
      freeExercises[exercise] && freeExercises[exercise].barbarian
    );

    if (isBarbarian) {
      let minVal = Infinity;
      Object.values(userRecords).forEach((user) => {
        const val = user.exercises[exercise];
        if (val !== undefined && val > 0 && val < minVal) minVal = val;
      });
      Object.values(userRecords).forEach((user) => {
        const val = user.exercises[exercise];
        const pct =
          val !== undefined && val > 0 && minVal !== Infinity
            ? (minVal / val) * 100
            : 0;
        user.scores[exercise] = pct;
        if (addToTotal) user.totalScore += pct;
      });
    } else {
      let maxVal = 0;
      Object.values(userRecords).forEach((user) => {
        const val = user.exercises[exercise] || 0;
        if (val > maxVal) maxVal = val;
      });
      Object.values(userRecords).forEach((user) => {
        const val = user.exercises[exercise] || 0;
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        user.scores[exercise] = pct;
        if (addToTotal) user.totalScore += pct;
      });
    }
  });
}

/**
 * フリーモードの総合得点集計（純粋）。app.js: getAllUsersScoresFree の集計部。
 * totalScore = 各種目の%の合計。
 */
export function computeFreeScores(
  posts: PostInput[],
  freeExercises: FreeExerciseMap,
  usersData: Record<string, string>,
): UserRecords {
  const exerciseKeys = Object.keys(freeExercises);
  const userRecords: UserRecords = {};

  posts.forEach((post) => {
    const { userId, exerciseType, value } = post;
    if (!userRecords[userId]) {
      userRecords[userId] = {
        userName: usersData[userId] || 'Unknown',
        exercises: {},
        scores: {},
        totalScore: 0,
      };
    }
    const isBarbarian = !!(
      freeExercises[exerciseType] && freeExercises[exerciseType].barbarian
    );
    applyBest(userRecords[userId], exerciseType, value, isBarbarian);
  });

  computePercentages(userRecords, exerciseKeys, freeExercises, true);
  return userRecords;
}

/**
 * 週間チャレンジの総合得点集計（純粋）。app.js: getAllUsersScoresWeekly の集計部。
 * 今週の平日・アクティブ種目のみを対象。下位3採用 + ストリーク加点。
 */
export function computeWeeklyScores(
  posts: PostInput[],
  freeExercises: FreeExerciseMap,
  usersData: Record<string, string>,
  opts: {
    weekStart: Date;
    weekEnd: Date;
    exerciseKeys: string[]; // getActiveWeeklyKeys 済みかつ freeExercises に存在するキー
    weeklyConfig: WeeklyConfig;
  },
): UserRecords {
  const { weekStart, weekEnd, exerciseKeys, weeklyConfig } = opts;
  const userRecords: UserRecords = {};

  posts.forEach((post) => {
    if (!post.timestamp) return;
    const postDate = post.timestamp;
    if (postDate < weekStart || postDate >= weekEnd) return;
    if (!isWeekdayJST(postDate)) return;
    if (!exerciseKeys.includes(post.exerciseType)) return;

    const { userId, exerciseType, value } = post;
    if (!userRecords[userId]) {
      userRecords[userId] = {
        userName: usersData[userId] || 'Unknown',
        exercises: {},
        scores: {},
        totalScore: 0,
        postedDays: new Set<number>(),
      };
    }
    const dIdx = weekdayIndexJST(postDate);
    if (dIdx >= 0) userRecords[userId].postedDays!.add(dIdx);

    const isBarbarian = !!(
      freeExercises[exerciseType] && freeExercises[exerciseType].barbarian
    );
    applyBest(userRecords[userId], exerciseType, value, isBarbarian);
  });

  // %計算（合計は後段で下位3採用するので addToTotal=false）
  computePercentages(userRecords, exerciseKeys, freeExercises, false);

  const streakEnabled = !!weeklyConfig.enableStreak;
  Object.values(userRecords).forEach((user) => {
    const baseTotal = sumAdoptedScores(
      exerciseKeys.map((k) => user.scores[k] || 0),
    );
    user.streakDays = longestConsecutiveDays(user.postedDays || new Set());
    user.streakBonus = streakEnabled
      ? computeStreakBonus(user.streakDays, weeklyConfig)
      : 0;
    user.totalScore = baseTotal + user.streakBonus;
  });

  return userRecords;
}

/** 総合得点で降順ソートし、同点は同順位にする。app.js の表示ロジックに対応。 */
export function rankUsers(
  userRecords: UserRecords,
): Array<{ userId: string; rec: UserRecord; rank: number }> {
  const sorted = Object.entries(userRecords).sort(
    (a, b) => b[1].totalScore - a[1].totalScore,
  );
  const out: Array<{ userId: string; rec: UserRecord; rank: number }> = [];
  let currentRank = 1;
  let previousScore: number | null = null;
  sorted.forEach(([userId, rec], index) => {
    if (previousScore !== null && rec.totalScore !== previousScore) {
      currentRank = index + 1;
    }
    previousScore = rec.totalScore;
    out.push({ userId, rec, rank: currentRank });
  });
  return out;
}
