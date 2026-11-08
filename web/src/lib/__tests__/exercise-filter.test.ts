import { describe, it, expect } from 'vitest';
import {
  collectExerciseTags,
  filterExercises,
  isFilterActive,
  matchesExerciseQuery,
  normalizeForSearch,
  toggleFilterTag,
} from '../exercise-filter';
import type { TagCatalog } from '../tag-catalog';
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
    expect(filterExercises(keys, get, { query: '', tags: [] })).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(filterExercises(keys, get, { query: 'すくわっと', tags: [] })).toEqual([
      'b',
      'd',
    ]);
    expect(filterExercises(keys, get, { query: '', tags: ['上半身'] })).toEqual([
      'a',
      'c',
    ]);
    expect(filterExercises(keys, get, { query: 'sit', tags: ['上半身'] })).toEqual([
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
    expect(isFilterActive({ query: ' ', tags: [] })).toBe(false);
    expect(isFilterActive({ query: 'a', tags: [] })).toBe(true);
    expect(isFilterActive({ query: '', tags: ['x'] })).toBe(true);
  });
});

describe('複数タグ（属性ごとに1つ）', () => {
  const catalog: TagCatalog = {
    categories: [
      { id: 'part', label: '部位', tags: ['上半身', '下半身', '体幹'] },
      { id: 'load', label: '負荷', tags: ['自重'] },
    ],
  };
  const ex: FreeExerciseMap = {
    a: { name: 'a', rule: '', icon: '', tags: ['上半身', '自重'] },
    b: { name: 'b', rule: '', icon: '', tags: ['上半身'] },
    c: { name: 'c', rule: '', icon: '', tags: ['下半身', '自重'] },
  };
  const get = (k: string) => ex[k];

  it('属性をまたぐタグは AND で絞り込む', () => {
    expect(
      filterExercises(['a', 'b', 'c'], get, { query: '', tags: ['上半身', '自重'] }),
    ).toEqual(['a']);
  });

  it('同じ属性のタグを選ぶと入れ替わり、別の属性は残る', () => {
    let f = toggleFilterTag({ query: '', tags: [] }, '上半身', catalog);
    f = toggleFilterTag(f, '自重', catalog);
    expect(f.tags).toEqual(['上半身', '自重']);
    f = toggleFilterTag(f, '下半身', catalog);
    expect(f.tags).toEqual(['自重', '下半身']);
    f = toggleFilterTag(f, '自重', catalog);
    expect(f.tags).toEqual(['下半身']);
  });
});
