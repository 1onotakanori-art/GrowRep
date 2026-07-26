import { describe, it, expect } from 'vitest';
import {
  sumAdoptedScores,
  longestConsecutiveDays,
  computeStreakBonus,
  computeFreeScores,
  computeWeeklyScores,
  rankUsers,
  type PostInput,
} from '../scoring';
import type { FreeExerciseMap, WeeklyConfig } from '../types';

const jst = (y: number, mo: number, d: number, h = 12): Date =>
  new Date(Date.UTC(y, mo - 1, d, h - 9));

describe('sumAdoptedScores（4種目以上は下位3採用）', () => {
  it('3件以下は全件合計', () => {
    expect(sumAdoptedScores([10, 20, 30])).toBe(60);
  });
  it('4件は最高の1件を切り捨てて下位3件合計', () => {
    expect(sumAdoptedScores([100, 20, 30, 40])).toBe(90); // 100を捨てる
  });
  it('非数値は0扱い', () => {
    // [NaN,10,Infinity,5]→[0,10,0,5]→昇順[0,0,5,10]→下位3=[0,0,5]=5
    expect(sumAdoptedScores([NaN, 10, Infinity, 5])).toBe(5);
  });
});

describe('longestConsecutiveDays', () => {
  it('月火水の連続は3、飛びは無視', () => {
    expect(longestConsecutiveDays(new Set([0, 1, 2, 4]))).toBe(3);
    expect(longestConsecutiveDays(new Set([0, 2, 4]))).toBe(1);
    expect(longestConsecutiveDays(new Set())).toBe(0);
  });
});

describe('computeStreakBonus', () => {
  it('perDay×日数、capで頭打ち', () => {
    expect(computeStreakBonus(3, { streakBonusPerDay: 3, streakBonusCap: 15 })).toBe(9);
    expect(computeStreakBonus(10, { streakBonusPerDay: 3, streakBonusCap: 15 })).toBe(15);
  });
  it('デフォルトは perDay=3, cap=15', () => {
    expect(computeStreakBonus(4)).toBe(12);
  });
});

const exercises: FreeExerciseMap = {
  pushup: { name: 'PU', rule: '', icon: 'fa-dumbbell', tags: [] },
  plank: { name: 'PL', rule: '', icon: 'fa-stopwatch', tags: [], barbarian: false },
  sprint: { name: 'SP', rule: '', icon: 'fa-bolt', tags: [], barbarian: true },
};

describe('computeFreeScores', () => {
  it('通常種目は最大値がベスト、最高値=100%', () => {
    const posts: PostInput[] = [
      { userId: 'u1', exerciseType: 'pushup', value: 50 },
      { userId: 'u1', exerciseType: 'pushup', value: 30 }, // ベストは50
      { userId: 'u2', exerciseType: 'pushup', value: 100 },
    ];
    const rec = computeFreeScores(posts, exercises, { u1: 'A', u2: 'B' });
    expect(rec.u1.exercises.pushup).toBe(50);
    expect(rec.u2.scores.pushup).toBe(100);
    expect(rec.u1.scores.pushup).toBe(50);
  });

  it('バーバリアン種目は最小値がベスト、最短=100%', () => {
    const posts: PostInput[] = [
      { userId: 'u1', exerciseType: 'sprint', value: 20 },
      { userId: 'u2', exerciseType: 'sprint', value: 10 }, // 最短=100%
    ];
    const rec = computeFreeScores(posts, exercises, { u1: 'A', u2: 'B' });
    expect(rec.u2.scores.sprint).toBe(100);
    expect(rec.u1.scores.sprint).toBe(50); // 10/20*100
  });
});

const weeklyConfig: WeeklyConfig = {
  weightExponent: 2,
  fairnessMode: 'two_stage',
  normalCount: 2,
  barbarianCount: 1,
  exerciseCount: 3,
  enableStreak: true,
  streakBonusPerDay: 3,
  streakBonusCap: 15,
  enablePrediction: false,
};

describe('computeWeeklyScores', () => {
  const weekStart = new Date('2026-07-19T08:00:00.000Z'); // 日17:00 JST
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);

  it('平日のアクティブ種目のみ集計、週末投稿は無視', () => {
    const posts: PostInput[] = [
      { userId: 'u1', exerciseType: 'pushup', value: 40, timestamp: jst(2026, 7, 20) }, // 月
      { userId: 'u1', exerciseType: 'pushup', value: 60, timestamp: jst(2026, 7, 21) }, // 火（ベスト）
      { userId: 'u1', exerciseType: 'pushup', value: 999, timestamp: jst(2026, 7, 25) }, // 土→無視
      { userId: 'u2', exerciseType: 'pushup', value: 80, timestamp: jst(2026, 7, 20) },
    ];
    const rec = computeWeeklyScores(posts, exercises, { u1: 'A', u2: 'B' }, {
      weekStart,
      weekEnd,
      exerciseKeys: ['pushup'],
      weeklyConfig,
    });
    expect(rec.u1.exercises.pushup).toBe(60); // 土の999は除外
    expect(rec.u2.scores.pushup).toBe(100);
  });

  it('ストリーク加点が合計に加算される', () => {
    const posts: PostInput[] = [
      { userId: 'u1', exerciseType: 'pushup', value: 10, timestamp: jst(2026, 7, 20) }, // 月
      { userId: 'u1', exerciseType: 'pushup', value: 10, timestamp: jst(2026, 7, 21) }, // 火
      { userId: 'u1', exerciseType: 'pushup', value: 10, timestamp: jst(2026, 7, 22) }, // 水
    ];
    const rec = computeWeeklyScores(posts, exercises, { u1: 'A' }, {
      weekStart,
      weekEnd,
      exerciseKeys: ['pushup'],
      weeklyConfig,
    });
    expect(rec.u1.streakDays).toBe(3);
    expect(rec.u1.streakBonus).toBe(9); // 3連続 × 3
    expect(rec.u1.totalScore).toBe(100 + 9); // 自分が唯一→100% + 9
  });
});

describe('rankUsers（同点は同順位）', () => {
  it('降順・タイ処理', () => {
    const recs = {
      a: { userName: 'A', exercises: {}, scores: {}, totalScore: 100 },
      b: { userName: 'B', exercises: {}, scores: {}, totalScore: 100 },
      c: { userName: 'C', exercises: {}, scores: {}, totalScore: 50 },
    };
    const ranked = rankUsers(recs);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(1); // 同点
    expect(ranked[2].rank).toBe(3); // index+1
  });
});
