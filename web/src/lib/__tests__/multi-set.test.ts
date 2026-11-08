import { describe, it, expect } from 'vitest';
import {
  MULTI_SET_MAX,
  MULTI_SET_VALUE_MAX,
  collectSetValues,
  suggestSetSplits,
  sumSetValues,
} from '../multi-set';

describe('suggestSetSplits', () => {
  it('残り42なら 2〜5セットの切り上げ', () => {
    expect(suggestSetSplits(42).map((s) => s.label)).toEqual([
      '2×21',
      '3×14',
      '4×11',
      '5×9',
    ]);
  });

  it('候補の合計は必ず残り以上', () => {
    for (let r = 1; r <= 200; r++) {
      for (const s of suggestSetSplits(r)) {
        expect(sumSetValues(s.values)).toBeGreaterThanOrEqual(r);
        expect(s.values.length).toBeLessThanOrEqual(MULTI_SET_MAX);
      }
    }
  });

  it('1セット5回未満になる候補は出さない', () => {
    expect(suggestSetSplits(14).map((s) => s.label)).toEqual(['2×7', '3×5']);
  });

  it('分けられないほど少なければ 1×残り', () => {
    expect(suggestSetSplits(7).map((s) => s.label)).toEqual(['1×7']);
  });

  it('残りが無ければ候補なし', () => {
    expect(suggestSetSplits(0)).toEqual([]);
    expect(suggestSetSplits(-3)).toEqual([]);
  });
});

describe('collectSetValues', () => {
  it('空欄と0を捨てて順番を保つ', () => {
    expect(collectSetValues(['15', '', '0', ' 12 ', '10'])).toEqual({
      values: [15, 12, 10],
      error: null,
    });
  });

  it('全部空なら empty', () => {
    expect(collectSetValues(['', '0']).error).toBe('empty');
  });

  it('小数・負・上限超えは invalid', () => {
    expect(collectSetValues(['10', '2.5']).error).toBe('invalid');
    expect(collectSetValues(['-3']).error).toBe('invalid');
    expect(collectSetValues([String(MULTI_SET_VALUE_MAX + 1)]).error).toBe(
      'invalid',
    );
    expect(collectSetValues([String(MULTI_SET_VALUE_MAX)]).error).toBeNull();
  });

  it('セット数の上限を超えたら too-many', () => {
    const raw = Array.from({ length: MULTI_SET_MAX + 1 }, () => '5');
    expect(collectSetValues(raw).error).toBe('too-many');
  });
});
