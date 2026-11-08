import { describe, it, expect } from 'vitest';
import {
  DROPSET_TAG,
  TARGET_REPS,
  withDropsetTag,
  withoutDropsetTag,
} from '../dropset';
import { DEFAULT_TAG_CATALOG, FORMAT_CATEGORY_ID, categoryIdOfTag } from '../tag-catalog';

describe('ドロップセットのタグ', () => {
  it('DROPSET_TAG は目標回数から作る 10-8-6 で、属性は「形式」', () => {
    expect(DROPSET_TAG).toBe(TARGET_REPS.join('-'));
    expect(DROPSET_TAG).toBe('10-8-6');
    expect(categoryIdOfTag(DEFAULT_TAG_CATALOG, DROPSET_TAG)).toBe(FORMAT_CATEGORY_ID);
  });

  it('ドロップセット種目には必ず付く（重複なし・ほかのタグは残す）', () => {
    expect(withDropsetTag([])).toEqual(['10-8-6']);
    expect(withDropsetTag(undefined)).toEqual(['10-8-6']);
    expect(withDropsetTag(['胸', 'ウェイト'])).toEqual(['胸', 'ウェイト', '10-8-6']);
    expect(withDropsetTag(['10-8-6', '背中', '10-8-6'])).toEqual(['背中', '10-8-6']);
  });

  it('フリー種目からは外す', () => {
    expect(withoutDropsetTag(['胸', '10-8-6', '自重'])).toEqual(['胸', '自重']);
    expect(withoutDropsetTag(undefined)).toEqual([]);
  });
});
