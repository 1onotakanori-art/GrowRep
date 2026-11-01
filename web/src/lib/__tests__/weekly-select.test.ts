import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  calcExerciseRatingModifier,
  calcCreatorRatingModifier,
  selectWeeklyExercisesWithBarbarianSlot,
  incrementCreatorHistory,
  getExerciseCreatorId,
} from '../weekly-select';
import type { FreeExerciseMap } from '../types';

afterEach(() => vi.restoreAllMocks());

describe('calcExerciseRatingModifier', () => {
  it('評価数3未満は係数1.0', () => {
    expect(calcExerciseRatingModifier({ avgRating: 5, ratingCount: 2, ratingSum: 10 })).toBe(1.0);
  });
  it('境界値', () => {
    expect(calcExerciseRatingModifier({ avgRating: 2, ratingCount: 3, ratingSum: 6 })).toBe(0.3);
    expect(calcExerciseRatingModifier({ avgRating: 3, ratingCount: 3, ratingSum: 9 })).toBeCloseTo(1.0);
    expect(calcExerciseRatingModifier({ avgRating: 4, ratingCount: 3, ratingSum: 12 })).toBe(2.0);
    expect(calcExerciseRatingModifier({ avgRating: 2.5, ratingCount: 3, ratingSum: 7.5 })).toBeCloseTo(0.65);
  });
});

describe('calcCreatorRatingModifier', () => {
  it('評価済み種目3未満は1.0', () => {
    expect(calcCreatorRatingModifier({ creatorRatedExerciseCount: 2, creatorAvgRating: 5 })).toBe(1.0);
  });
  it('低評価0.6 / 高評価1.4 / 中間1.0', () => {
    expect(calcCreatorRatingModifier({ creatorRatedExerciseCount: 3, creatorAvgRating: 2 })).toBe(0.6);
    expect(calcCreatorRatingModifier({ creatorRatedExerciseCount: 3, creatorAvgRating: 4 })).toBe(1.4);
    expect(calcCreatorRatingModifier({ creatorRatedExerciseCount: 3, creatorAvgRating: 3 })).toBe(1.0);
  });
});

describe('getExerciseCreatorId / incrementCreatorHistory', () => {
  const ex: FreeExerciseMap = {
    a: { name: 'a', rule: '', icon: '', tags: [], createdBy: 'user1' },
    b: { name: 'b', rule: '', icon: '', tags: [] }, // createdBy なし→擬似ID
  };
  it('createdBy が無い種目は __ex_<key> を作成者IDにする', () => {
    expect(getExerciseCreatorId(ex, 'a')).toBe('user1');
    expect(getExerciseCreatorId(ex, 'b')).toBe('__ex_b');
  });
  it('選出作成者の回数を+1（非破壊）', () => {
    const base = { user1: 1 };
    const next = incrementCreatorHistory(base, ['a', 'b'], ex);
    expect(next).toEqual({ user1: 2, __ex_b: 1 });
    expect(base).toEqual({ user1: 1 }); // 元は不変
  });
});

describe('selectWeeklyExercisesWithBarbarianSlot', () => {
  const ex: FreeExerciseMap = {
    n1: { name: 'n1', rule: '', icon: '', tags: [], createdBy: 'c1' },
    n2: { name: 'n2', rule: '', icon: '', tags: [], createdBy: 'c2' },
    n3: { name: 'n3', rule: '', icon: '', tags: [], createdBy: 'c3' },
    n4: { name: 'n4', rule: '', icon: '', tags: [], createdBy: 'c4' },
    b1: { name: 'b1', rule: '', icon: '', tags: [], barbarian: true, createdBy: 'c5' },
    excl: { name: 'x', rule: '', icon: '', tags: [], excludeFromWeekly: true, createdBy: 'c6' },
  };

  it('excludeFromWeekly は選出されない', () => {
    // Math.random を固定して決定的に
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const picks = selectWeeklyExercisesWithBarbarianSlot(ex, {}, 2, {}, {}, {
      normalCount: 2,
      barbarianCount: 1,
    });
    expect(picks).not.toContain('excl');
    expect(picks.length).toBe(3);
    // バーバリアン枠が1つ含まれる
    expect(picks.filter((k) => ex[k]?.barbarian).length).toBe(1);
  });

  it('revealCount で末尾に追加normalが付与され計4種目', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const picks = selectWeeklyExercisesWithBarbarianSlot(ex, {}, 2, {}, {}, {
      normalCount: 2,
      barbarianCount: 1,
      revealCount: 1,
    });
    expect(picks.length).toBe(4);
    // 重複なし
    expect(new Set(picks).size).toBe(4);
  });
});

describe('selectWeeklyExercisesWithBarbarianSlot: 前週の種目を外す', () => {
  const mk = (createdBy: string, barbarian = false) => ({
    name: createdBy,
    rule: '',
    icon: '',
    tags: [],
    createdBy,
    ...(barbarian ? { barbarian: true } : {}),
  });

  it('excludeKeys の種目は2週連続で選ばれない（作成者内で回数が並んでいても）', () => {
    // 同じ作成者のTAが2つ・どちらも選出1回。前週は b1
    const ex: FreeExerciseMap = {
      n1: mk('c1'),
      n2: mk('c2'),
      n3: mk('c3'),
      n4: mk('c4'),
      b1: mk('c5', true),
      b2: mk('c5', true),
    };
    const history = { b1: 1, b2: 1, n1: 1, n2: 1 };
    for (let i = 0; i < 300; i++) {
      const picks = selectWeeklyExercisesWithBarbarianSlot(ex, history, 3, {}, {}, {
        normalCount: 2,
        barbarianCount: 1,
        excludeKeys: ['n1', 'n2', 'b1'],
      });
      expect(picks).toHaveLength(3);
      expect(picks).not.toContain('b1');
      expect(picks).not.toContain('n1');
      expect(picks).not.toContain('n2');
    }
  });

  it('外すと枠が埋まらないプールだけは前週の種目も候補に戻す', () => {
    // TA は1つしか無い → 前週と同じでも選ぶ。normal は外しても足りる
    const ex: FreeExerciseMap = {
      n1: mk('c1'),
      n2: mk('c2'),
      n3: mk('c3'),
      n4: mk('c4'),
      b1: mk('c5', true),
    };
    for (let i = 0; i < 100; i++) {
      const picks = selectWeeklyExercisesWithBarbarianSlot(ex, {}, 2, {}, {}, {
        normalCount: 2,
        barbarianCount: 1,
        excludeKeys: ['n1', 'n2', 'b1'],
      });
      expect(picks).toContain('b1');
      expect(picks.slice(0, 2).sort()).toEqual(['n3', 'n4']);
    }
  });

  it('水曜公開枠も前週の種目を避ける', () => {
    const ex: FreeExerciseMap = {
      n1: mk('c1'),
      n2: mk('c2'),
      n3: mk('c3'),
      n4: mk('c4'),
      n5: mk('c5'),
      b1: mk('c6', true),
    };
    for (let i = 0; i < 100; i++) {
      const picks = selectWeeklyExercisesWithBarbarianSlot(ex, {}, 2, {}, {}, {
        normalCount: 2,
        barbarianCount: 1,
        revealCount: 1,
        excludeKeys: ['n1', 'n2'],
      });
      expect(picks).toHaveLength(4);
      expect(picks).not.toContain('n1');
      expect(picks).not.toContain('n2');
    }
  });
});
