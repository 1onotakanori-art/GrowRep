import { describe, expect, it } from 'vitest';
import { computeWeeklyScores, type PostInput } from '../scoring';
import {
  clampSimValue,
  countSimOverrides,
  rankMovement,
  setSimOverride,
  simulateWeeklyRecords,
} from '../weekly-simulator';
import type { FreeExerciseMap, WeeklyConfig } from '../types';

const jst = (y: number, mo: number, d: number, h = 12): Date =>
  new Date(Date.UTC(y, mo - 1, d, h - 9));

const exercises: FreeExerciseMap = {
  pushup: { name: 'PU', rule: '', icon: 'fa-dumbbell', tags: [] },
  squat: { name: 'SQ', rule: '', icon: 'fa-dumbbell', tags: [] },
  sprint: { name: 'SP', rule: '', icon: 'fa-bolt', tags: [], barbarian: true },
};
const keys = ['pushup', 'squat', 'sprint'];

const config: WeeklyConfig = {
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

// 2026-10-12(月)〜10-16(金) の週
const weekStart = jst(2026, 10, 12, 0);
const weekEnd = jst(2026, 10, 17, 0);
const posts: PostInput[] = [
  // A: 月火に投稿（2日連続 → +6）
  { userId: 'a', exerciseType: 'pushup', value: 50, timestamp: jst(2026, 10, 12) },
  { userId: 'a', exerciseType: 'squat', value: 40, timestamp: jst(2026, 10, 13) },
  { userId: 'a', exerciseType: 'sprint', value: 20, timestamp: jst(2026, 10, 13) },
  // B: 水だけ（1日 → +3）
  { userId: 'b', exerciseType: 'pushup', value: 100, timestamp: jst(2026, 10, 14) },
  { userId: 'b', exerciseType: 'squat', value: 20, timestamp: jst(2026, 10, 14) },
  { userId: 'b', exerciseType: 'sprint', value: 10, timestamp: jst(2026, 10, 14) },
];
const base = computeWeeklyScores(posts, exercises, { a: 'A', b: 'B' }, {
  weekStart,
  weekEnd,
  exerciseKeys: keys,
  weeklyConfig: config,
});

describe('clampSimValue', () => {
  it('負数は0、小数は第1位まで', () => {
    expect(clampSimValue(-5)).toBe(0);
    expect(clampSimValue('12.34')).toBe(12.3);
    expect(clampSimValue(30)).toBe(30);
  });
  it('数でない・空なら fallback', () => {
    expect(clampSimValue('abc', 7)).toBe(7);
    expect(clampSimValue('', 7)).toBe(7);
  });
});

describe('setSimOverride', () => {
  it('書き換えを足し、元のオブジェクトは変えない', () => {
    const o0 = {};
    const o1 = setSimOverride(o0, 'a', 'pushup', 120, 50);
    expect(o1).toEqual({ a: { pushup: 120 } });
    expect(o0).toEqual({});
    expect(countSimOverrides(o1)).toBe(1);
  });
  it('実際の記録と同じ値に戻すと消える', () => {
    const o1 = setSimOverride({}, 'a', 'pushup', 120, 50);
    expect(setSimOverride(o1, 'a', 'pushup', 50, 50)).toEqual({});
  });
});

describe('simulateWeeklyRecords', () => {
  it('書き換えなしなら本番の集計と同じ得点', () => {
    const sim = simulateWeeklyRecords(base, keys, exercises, {});
    expect(sim.a.totalScore).toBeCloseTo(base.a.totalScore, 6);
    expect(sim.b.totalScore).toBeCloseTo(base.b.totalScore, 6);
  });

  it('最高記録を塗り替えると相手の%も下がり、順位が入れ替わる', () => {
    // 実際: A = 50 + 100 + 50 + 6 = 206, B = 100 + 50 + 100 + 3 = 253
    expect(base.a.totalScore).toBeCloseTo(206, 6);
    expect(base.b.totalScore).toBeCloseTo(253, 6);
    // A の pushup を 200 に → A=100+100+50+6=256, B=50+50+100+3=203
    const sim = simulateWeeklyRecords(base, keys, exercises, { a: { pushup: 200 } });
    expect(sim.a.totalScore).toBeCloseTo(256, 6);
    expect(sim.b.totalScore).toBeCloseTo(203, 6);
    expect(rankMovement(base, sim)).toEqual({ a: 1, b: -1 });
  });

  it('タイムアタックは短いほど高得点、0は記録なし扱い', () => {
    const faster = simulateWeeklyRecords(base, keys, exercises, { a: { sprint: 5 } });
    expect(faster.a.scores.sprint).toBe(100);
    expect(faster.b.scores.sprint).toBe(50);
    const none = simulateWeeklyRecords(base, keys, exercises, { a: { sprint: 0 } });
    expect(none.a.scores.sprint).toBe(0);
    expect(none.b.scores.sprint).toBe(100);
  });

  it('ストリーク加点はそのまま、base は変更しない', () => {
    const sim = simulateWeeklyRecords(base, keys, exercises, { b: { squat: 999 } });
    expect(sim.a.streakBonus).toBe(6);
    expect(sim.b.streakBonus).toBe(3);
    expect(base.b.exercises.squat).toBe(20);
  });
});
