// 種目タグの属性（部位・負荷・ペース…）の定義と、タグを属性ごとにまとめる純粋関数。
//
// 種目のタグそのものは従来どおりフラットな文字列配列（ex.tags）のまま。
// app.js・分析スクリプト・レイド判定（'レイド' タグ）がそれを前提にしているので、
// 「どのタグがどの属性か」は別ドキュメント settings_free/tag_catalog に持つ。
// Firestore の読み書きは tag-catalog-engine.ts。

export interface TagCategory {
  id: string;
  label: string;
  /** この属性のタグ（表示順） */
  tags: string[];
}

export interface TagCatalog {
  categories: TagCategory[];
}

/** どの属性にも入っていないタグ（旧版で付けたフリータグなど）の受け皿。 */
export const OTHER_CATEGORY_ID = 'other';
export const OTHER_CATEGORY_LABEL = 'その他';

/** 「形式」の属性 id。ドロップセットは形式が 10-8-6 に決まっているので、フォームで選ばせない */
export const FORMAT_CATEGORY_ID = 'format';

/**
 * settings_free/tag_catalog が未作成のときに使う初期値。
 * 2026-11-08 時点で Firestore の種目に付いていたタグをすべて振り分けたもの。
 */
export const DEFAULT_TAG_CATALOG: TagCatalog = {
  categories: [
    {
      id: 'part',
      label: '部位',
      tags: ['胸', '背中', '肩', '腕', '前腕', '肘', '脚', '腹', '体幹', '全身'],
    },
    { id: 'load', label: '負荷', tags: ['自重', 'ウェイト'] },
    { id: 'pace', label: 'ペース', tags: ['1秒1回', '2秒1回', '3秒1回', '6秒1回'] },
    // '10-8-6' は dropset.ts の DROPSET_TAG。ドロップセット種目にだけ自動で付く
    { id: FORMAT_CATEGORY_ID, label: '形式', tags: ['耐久', '1分間', '10-8-6'] },
    // 'レイド' は raid-mode.ts の RAID_TAG。付けた種目がレイドの候補になる
    { id: 'event', label: 'イベント', tags: ['レイド', 'スペシャル神谷ウィー'] },
  ],
};

/**
 * Firestore から読んだ値を TagCatalog に整える。
 * 形が壊れていれば初期値、同じタグが複数の属性にあれば先に出た方を採る。
 */
export function normalizeTagCatalog(raw: unknown): TagCatalog {
  const cats = (raw as { categories?: unknown })?.categories;
  if (!Array.isArray(cats) || cats.length === 0) return cloneCatalog(DEFAULT_TAG_CATALOG);
  const seenTags = new Set<string>();
  const seenIds = new Set<string>();
  const categories: TagCategory[] = [];
  for (const c of cats) {
    const id = typeof c?.id === 'string' ? c.id.trim() : '';
    const label = typeof c?.label === 'string' ? c.label.trim() : '';
    if (!id || !label || id === OTHER_CATEGORY_ID || seenIds.has(id)) continue;
    seenIds.add(id);
    const tags: string[] = [];
    for (const t of Array.isArray(c.tags) ? c.tags : []) {
      const tag = typeof t === 'string' ? t.trim() : '';
      if (!tag || seenTags.has(tag)) continue;
      seenTags.add(tag);
      tags.push(tag);
    }
    categories.push({ id, label, tags });
  }
  return categories.length ? { categories } : cloneCatalog(DEFAULT_TAG_CATALOG);
}

function cloneCatalog(c: TagCatalog): TagCatalog {
  return { categories: c.categories.map((x) => ({ ...x, tags: [...x.tags] })) };
}

/** タグの属性 id。カタログに無ければ 'other'。 */
export function categoryIdOfTag(catalog: TagCatalog, tag: string): string {
  for (const c of catalog.categories) if (c.tags.includes(tag)) return c.id;
  return OTHER_CATEGORY_ID;
}

export interface TagGroup {
  id: string;
  label: string;
  tags: string[];
}

/**
 * タグを属性ごとにまとめる。属性はカタログの順、属性内もカタログの順。
 * カタログに無いタグは最後の「その他」へ（入力順）。空の属性は省く。
 * includeEmpty=true なら空の属性も返す（種目フォームで全属性を並べる用）。
 */
export function groupTags(
  catalog: TagCatalog,
  tags: Iterable<string>,
  { includeEmpty = false }: { includeEmpty?: boolean } = {},
): TagGroup[] {
  const set = new Set(tags);
  const groups: TagGroup[] = catalog.categories.map((c) => ({
    id: c.id,
    label: c.label,
    tags: c.tags.filter((t) => set.has(t)),
  }));
  const known = new Set(catalog.categories.flatMap((c) => c.tags));
  const other = [...set].filter((t) => !known.has(t));
  groups.push({ id: OTHER_CATEGORY_ID, label: OTHER_CATEGORY_LABEL, tags: other });
  return includeEmpty
    ? groups.filter((g) => g.id !== OTHER_CATEGORY_ID || g.tags.length > 0)
    : groups.filter((g) => g.tags.length > 0);
}

/** 種目カードに並べる順（属性順 → 属性内の順 → その他）。 */
export function sortTagsByCatalog(catalog: TagCatalog, tags: string[]): string[] {
  return groupTags(catalog, tags).flatMap((g) => g.tags);
}

export interface TagAddition {
  tag: string;
  categoryId: string;
}

/**
 * カタログにタグを追加した新しいカタログを返す（元は変更しない）。
 * 既にどこかの属性にあるタグ・存在しない属性への追加は無視する。
 */
export function addTagsToCatalog(
  catalog: TagCatalog,
  additions: TagAddition[],
): TagCatalog {
  const next = cloneCatalog(catalog);
  const known = new Set(next.categories.flatMap((c) => c.tags));
  for (const { tag: raw, categoryId } of additions) {
    const tag = raw.trim();
    if (!tag || known.has(tag)) continue;
    const cat = next.categories.find((c) => c.id === categoryId);
    if (!cat) continue;
    cat.tags.push(tag);
    known.add(tag);
  }
  return next;
}
