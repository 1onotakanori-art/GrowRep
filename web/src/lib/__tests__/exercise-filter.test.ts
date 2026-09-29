import { describe, it, expect } from 'vitest';
import {
  collectExerciseTags,
  filterExercises,
  isFilterActive,
  matchesExerciseQuery,
  normalizeForSearch,
} from '../exercise-filter';
import type { FreeExerciseMap } from '../types';

const exercises: FreeExerciseMap = {
  a: { name: '腕立て伏せ', rule: '胸を床に近づける', icon: '', tags: ['上半身'] },
  b: { name: 'スクワット', rule: '太ももが床と平行', icon: '', tags: ['下半身'] },
  c: { name: 'L-Sit', rule: '', icon: '', tags: ['体幹', '上半身'] },
  d: { name: 'ブルガリアンスクワット', rule: '', icon: '', tags: [] },
};

describe('normalizeForSearch', () => {
  it('カタカナをひらがなに、全角英数を半角小文字に揃える', () => {
    expect(normalizeForSearch('スクワット')).toBe('すくわっと');
    expect(normalizeForSearch('Ｌ－ＳＩＴ')).toBe('l-sit');
    expect(normalizeForSearch('ｽｸﾜｯﾄ')).toBe('すくわっと');
  });
});

describe('matchesExerciseQuery', () => {
  it('空の検索語は常に一致', () => {
    expect(matchesExerciseQuery(exercises.a, '')).toBe(true);
    expect(matchesExerciseQuery(exercises.a, '   ')).toBe(true);
  });

  it('名前・ルール・タグで一致する', () => {
    expect(matchesExerciseQuery(exercises.a, '腕立て')).toBe(true);
    expect(matchesExerciseQuery(exercises.b, '平行')).toBe(true);
    expect(matchesExerciseQuery(exercises.c, '体幹')).toBe(true);
    expect(matchesExerciseQuery(exercises.a, '下半身')).toBe(false);
  });

  it('ひらがな・大小文字の違いを無視する', () => {
    expect(matchesExerciseQuery(exercises.b, 'すくわっと')).toBe(true);
    expect(matchesExerciseQuery(exercises.c, 'l-sit')).toBe(true);
  });

  it('空白区切りは AND 検索', () => {
    expect(matchesExerciseQuery(exercises.d, 'ぶるがりあん すくわっと')).toBe(true);
    expect(matchesExerciseQuery(exercises.b, 'ぶるがりあん すくわっと')).toBe(false);
  });
});

describe('filterExercises', () => {
  const keys = Object.keys(exercises).concat('missing');
  const get = (k: string) => exercises[k];

  it('検索語とタグの両方で絞り込み、解決できないキーは除く', () => {
    expect(filterExercises(keys, get, { query: '', tag: null })).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(filterExercises(keys, get, { query: 'すくわっと', tag: null })).toEqual([
      'b',
      'd',
    ]);
    expect(filterExercises(keys, get, { query: '', tag: '上半身' })).toEqual([
      'a',
      'c',
    ]);
    expect(filterExercises(keys, get, { query: 'sit', tag: '上半身' })).toEqual([
      'c',
    ]);
  });
});

describe('collectExerciseTags / isFilterActive', () => {
  it('タグを出現順・重複なしで集める', () => {
    expect(collectExerciseTags(Object.values(exercises))).toEqual([
      '上半身',
      '下半身',
      '体幹',
    ]);
  });

  it('検索語かタグがあれば有効', () => {
    expect(isFilterActive({ query: ' ', tag: null })).toBe(false);
    expect(isFilterActive({ query: 'a', tag: null })).toBe(true);
    expect(isFilterActive({ query: '', tag: 'x' })).toBe(true);
  });
});
