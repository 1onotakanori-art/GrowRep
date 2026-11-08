import { describe, it, expect } from 'vitest';
import { favoritesFirst, toggleInList } from '../favorites';

describe('favoritesFirst', () => {
  it('お気に入りを先頭へ。どちらのグループも元の順を保つ', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    expect(favoritesFirst(items, (k) => k, new Set(['d', 'b']))).toEqual([
      'b',
      'd',
      'a',
      'c',
      'e',
    ]);
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('お気に入りが無ければそのまま', () => {
    const items = [{ k: 'x' }];
    expect(favoritesFirst(items, (i) => i.k, new Set())).toBe(items);
  });
});

describe('toggleInList', () => {
  it('追加は末尾・重複なし、解除は取り除く', () => {
    expect(toggleInList(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(toggleInList(['a', 'b'], 'a', true)).toEqual(['b', 'a']);
    expect(toggleInList(['a', 'b'], 'a', false)).toEqual(['b']);
    expect(toggleInList([], 'a', false)).toEqual([]);
  });
});
