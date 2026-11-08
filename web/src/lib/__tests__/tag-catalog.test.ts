import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TAG_CATALOG,
  OTHER_CATEGORY_ID,
  addTagsToCatalog,
  categoryIdOfTag,
  groupTags,
  normalizeTagCatalog,
  sortTagsByCatalog,
  type TagCatalog,
} from '../tag-catalog';
import { RAID_TAG } from '../raid-mode';
import { TARGET_REPS, isCleared } from '../dropset';

const catalog: TagCatalog = {
  categories: [
    { id: 'part', label: '部位', tags: ['胸', '背中', '脚'] },
    { id: 'load', label: '負荷', tags: ['自重', 'ウェイト'] },
  ],
};

describe('normalizeTagCatalog', () => {
  it('未作成・壊れた値は初期値になる', () => {
    expect(normalizeTagCatalog(null)).toEqual(DEFAULT_TAG_CATALOG);
    expect(normalizeTagCatalog({ categories: 'x' })).toEqual(DEFAULT_TAG_CATALOG);
    expect(normalizeTagCatalog({ categories: [{ id: '', label: '' }] })).toEqual(
      DEFAULT_TAG_CATALOG,
    );
  });

  it('初期値を返しても元の定数は書き換えられない', () => {
    const c = normalizeTagCatalog(null);
    c.categories[0].tags.push('x');
    expect(DEFAULT_TAG_CATALOG.categories[0].tags).not.toContain('x');
  });

  it('同じタグが複数の属性にあれば先の属性を採る・"other" や重複 id は捨てる', () => {
    const c = normalizeTagCatalog({
      categories: [
        { id: 'part', label: '部位', tags: ['胸', ' 胸 ', '', 1] },
        { id: 'load', label: '負荷', tags: ['胸', '自重'] },
        { id: 'part', label: '重複', tags: ['肩'] },
        { id: OTHER_CATEGORY_ID, label: 'その他', tags: ['謎'] },
      ],
    });
    expect(c.categories).toEqual([
      { id: 'part', label: '部位', tags: ['胸'] },
      { id: 'load', label: '負荷', tags: ['自重'] },
    ]);
  });
});

describe('groupTags / sortTagsByCatalog', () => {
  it('属性順・属性内の順にまとめ、知らないタグは最後の「その他」へ', () => {
    expect(groupTags(catalog, ['謎', '自重', '脚', '胸'])).toEqual([
      { id: 'part', label: '部位', tags: ['胸', '脚'] },
      { id: 'load', label: '負荷', tags: ['自重'] },
      { id: OTHER_CATEGORY_ID, label: 'その他', tags: ['謎'] },
    ]);
    expect(sortTagsByCatalog(catalog, ['謎', '自重', '脚', '胸'])).toEqual([
      '胸',
      '脚',
      '自重',
      '謎',
    ]);
  });

  it('空の属性は省く。includeEmpty なら残す（その他は中身があるときだけ）', () => {
    expect(groupTags(catalog, ['胸']).map((g) => g.id)).toEqual(['part']);
    expect(groupTags(catalog, ['胸'], { includeEmpty: true }).map((g) => g.id)).toEqual([
      'part',
      'load',
    ]);
  });

  it('categoryIdOfTag', () => {
    expect(categoryIdOfTag(catalog, 'ウェイト')).toBe('load');
    expect(categoryIdOfTag(catalog, '謎')).toBe(OTHER_CATEGORY_ID);
  });
});

describe('addTagsToCatalog', () => {
  it('指定した属性の末尾に足す。既存のタグ・無い属性・空文字は無視', () => {
    const next = addTagsToCatalog(catalog, [
      { tag: ' 肩 ', categoryId: 'part' },
      { tag: '胸', categoryId: 'load' },
      { tag: '鉄', categoryId: 'nope' },
      { tag: '', categoryId: 'part' },
      { tag: '肩', categoryId: 'load' },
    ]);
    expect(next.categories[0].tags).toEqual(['胸', '背中', '脚', '肩']);
    expect(next.categories[1].tags).toEqual(['自重', 'ウェイト']);
    // 元は変更しない
    expect(catalog.categories[0].tags).toEqual(['胸', '背中', '脚']);
  });
});

describe('初期カタログ', () => {
  it('Firestore の既存タグをすべて含み、重複が無い', () => {
    const all = DEFAULT_TAG_CATALOG.categories.flatMap((c) => c.tags);
    expect(new Set(all).size).toBe(all.length);
    // 2026-11-08 時点で settings_free / settings_dropset の種目に付いていたタグ
    const existing = [
      '肩', '腕', 'ウェイト', '前腕', '脚', '自重', '胸', '背中', '腹', '全身', '体幹',
      '1秒1回', '6秒1回', '3秒1回', '耐久', 'レイド', '2秒1回', '1分間',
      'スペシャル神谷ウィー', '肘', '10-8-6',
    ];
    for (const t of existing) expect(all).toContain(t);
  });

  it('レイド判定のタグはイベントに入っている', () => {
    expect(categoryIdOfTag(DEFAULT_TAG_CATALOG, RAID_TAG)).toBe('event');
  });
});

describe('既存の判定に影響しない', () => {
  // 属性分けは表示の並び替えだけ。種目の tags 配列は書き換えず、
  // レイド判定（hasRaidTag）は ex.tags を直接見る
  it('並び替えでタグが落ちたり増えたりしない（その他を含む）', () => {
    const tags = ['謎タグ', 'レイド', '10-8-6', '胸', 'ウェイト', '3秒1回'];
    const sorted = sortTagsByCatalog(DEFAULT_TAG_CATALOG, tags);
    expect([...sorted].sort()).toEqual([...tags].sort());
  });

  it('ドロップセット種目の実データのタグはすべて属性に入る（10-8-6 は形式）', () => {
    // settings_dropset/exercises（2026-11-08 時点）
    for (const tags of [
      ['背中', 'ウェイト', '10-8-6'],
      ['胸', 'ウェイト', '10-8-6'],
      ['肩', 'ウェイト', '10-8-6'],
    ]) {
      const groups = groupTags(DEFAULT_TAG_CATALOG, tags);
      expect(groups.map((g) => g.id)).toEqual(['part', 'load', 'format']);
      expect(groups.flatMap((g) => g.tags).sort()).toEqual([...tags].sort());
    }
    expect(categoryIdOfTag(DEFAULT_TAG_CATALOG, '10-8-6')).toBe('format');
  });

  it('ドロップセットのクリア判定は目標回数（TARGET_REPS）で決まり、タグを見ない', () => {
    // isCleared は種目もタグも受け取らない。10-8-6 タグの有無で結果は変わらない
    expect(TARGET_REPS).toEqual([10, 8, 6]);
    expect(isCleared([10, 8, 6])).toBe(true);
    expect(isCleared([10, 8, 5])).toBe(false);
  });
});
