import { describe, expect, it } from 'vitest';
import {
  buildCreatorRanking,
  computePostStats,
  createRng,
  creatorTier,
  estimateSelectionProbabilities,
  formatProb,
  popularExercises,
  ratingBoostedExercises,
  topRatedExercises,
  trendingExercises,
  type SelectionInput,
} from '../exercise-insights';
import type { FreeExerciseMap } from '../types';

const now = new Date('2026-10-18T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);

const ex = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  rule: '',
  icon: 'fa-dumbbell',
  tags: [],
  ...extra,
});

describe('computePostStats', () => {
  it('累計・直近7日・8〜14日前を数える', () => {
    const stats = computePostStats(
      [
        { exerciseType: 'a', timestamp: daysAgo(1) },
        { exerciseType: 'a', timestamp: daysAgo(6.9) },
        { exerciseType: 'a', timestamp: daysAgo(10) },
        { exerciseType: 'a', timestamp: daysAgo(30) },
        { exerciseType: 'a', timestamp: null },
        { exerciseType: 'b', timestamp: daysAgo(2) },
      ],
      now,
    );
    expect(stats.a).toEqual({ total: 5, recent7: 2, prev7: 1 });
    expect(stats.b).toEqual({ total: 1, recent7: 1, prev7: 0 });
  });
});

describe('ダッシュボードの並び', () => {
  const stats = {
    a: { total: 50, recent7: 2, prev7: 8 },
    b: { total: 10, recent7: 6, prev7: 1 },
    c: { total: 30, recent7: 5, prev7: 0 },
  };
  const keys = ['a', 'b', 'c', 'none'];
  it('急増中は 直近−前週 の大きい順、同点は直近の多い順', () => {
    expect(trendingExercises(stats, keys)).toEqual([
      { key: 'b', value: 5 },
      { key: 'c', value: 5 },
      { key: 'a', value: -6 },
    ]);
  });
  it('人気は累計の多い順、投稿0件は出さない', () => {
    expect(popularExercises(stats, keys).map((x) => x.key)).toEqual(['a', 'c', 'b']);
  });
  it('高評価は評価3件以上だけ', () => {
    const ratings = {
      a: { avgRating: 4.8, ratingCount: 2, ratingSum: 9.6 },
      b: { avgRating: 4.1, ratingCount: 3, ratingSum: 12.3 },
      c: { avgRating: 4.5, ratingCount: 5, ratingSum: 22.5 },
    };
    expect(topRatedExercises(ratings, keys)).toEqual([
      { key: 'c', value: 4.5 },
      { key: 'b', value: 4.1 },
    ]);
  });
});

describe('createRng', () => {
  it('同じシードなら同じ列、0以上1未満', () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b()));
    xs.forEach((x) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    });
  });
});

describe('estimateSelectionProbabilities', () => {
  const exercises: FreeExerciseMap = {
    // 2段階抽選では種目の選出回数・評価は「同じ作成者の種目どうし」でだけ効くので、
    // n1 と n2 を同じ作成者にしておく
    n1: ex('通常1', { createdBy: 'u1' }),
    n2: ex('通常2', { createdBy: 'u1' }),
    n3: ex('通常3', { createdBy: 'u3' }),
    n4: ex('通常4', { createdBy: 'u4' }),
    t1: ex('タイム1', { createdBy: 'u1', barbarian: true }),
    t2: ex('タイム2', { createdBy: 'u2', barbarian: true }),
    off: ex('対象外', { createdBy: 'u3', excludeFromWeekly: true }),
  } as FreeExerciseMap;
  const base: SelectionInput = {
    exercises,
    history: {},
    creatorHistory: {},
    ratings: {},
    creators: {},
    config: {
      weightExponent: 2,
      fairnessMode: 'two_stage',
      normalCount: 2,
      barbarianCount: 1,
      exerciseCount: 3,
    },
  };

  it('毎回 通常2 + タイム1 = 3種目なので確率の合計は3、対象外は0', () => {
    const est = estimateSelectionProbabilities(base, 2000);
    const sum = Object.values(est).reduce((s, e) => s + e.prob, 0);
    expect(sum).toBeCloseTo(3, 6);
    expect(est.off.prob).toBe(0);
    ['n1', 'n2', 'n3', 'n4', 't1', 't2'].forEach((k) =>
      expect(est[k].prob).toBeGreaterThan(0.1),
    );
  });

  it('同じ入力なら同じ推定値（シード固定）で、Math.random は元に戻る', () => {
    const before = Math.random;
    const a = estimateSelectionProbabilities(base, 500);
    const b = estimateSelectionProbabilities(base, 500);
    expect(a).toEqual(b);
    expect(Math.random).toBe(before);
  });

  it('同じ作成者の中では、よく選ばれてきた種目ほど確率が下がる', () => {
    const est = estimateSelectionProbabilities({ ...base, history: { n1: 5 } }, 2000);
    expect(est.n1.prob).toBeLessThan(est.n2.prob / 3);
  });

  it('高評価（3件以上で★4以上）は同じ作成者の中で確率が上がり「評価で確率UP」に出る', () => {
    const ratings = { n1: { avgRating: 4.6, ratingCount: 4, ratingSum: 18.4 } };
    const est = estimateSelectionProbabilities({ ...base, ratings }, 2000);
    expect(est.n1.prob).toBeGreaterThan(est.n1.probWithoutRating);
    expect(ratingBoostedExercises(est, Object.keys(exercises))[0].key).toBe('n1');
  });
});

describe('formatProb', () => {
  it('10%未満は小数1桁、0.1%未満は <0.1%', () => {
    expect(formatProb(0)).toBe('0%');
    expect(formatProb(0.0004)).toBe('<0.1%');
    expect(formatProb(0.034)).toBe('3.4%');
    expect(formatProb(0.456)).toBe('46%');
  });
});

describe('buildCreatorRanking / creatorTier', () => {
  const exercises = {
    a: ex('A', { createdByName: 'たろう' }),
    b: ex('B', { createdByName: 'たろう' }),
    c: ex('C', { createdByName: 'はなこ' }),
    d: ex('D', { createdByName: 'じろう' }),
    e: ex('E', { createdByName: '（復元）' }),
    f: ex('F'),
  } as FreeExerciseMap;
  const ratings = {
    a: { avgRating: 4.5, ratingCount: 2, ratingSum: 9 },
    b: { avgRating: 3.5, ratingCount: 1, ratingSum: 3.5 },
    c: { avgRating: 2.0, ratingCount: 3, ratingSum: 6 },
  };
  it('作成者ごとの平均評価の高い順、評価なしは末尾、（復元）と作成者なしは除く', () => {
    const list = buildCreatorRanking(exercises, ratings);
    expect(list.map((c) => [c.name, c.avgRating, c.keys.length])).toEqual([
      ['たろう', 4, 2],
      ['はなこ', 2, 1],
      ['じろう', null, 1],
    ]);
  });
  it('★4以上=優良、3以上=良、3未満=要改善', () => {
    expect(creatorTier(4)).toBe('excellent');
    expect(creatorTier(3.2)).toBe('good');
    expect(creatorTier(2.9)).toBe('bad');
    expect(creatorTier(null)).toBeNull();
  });
});
