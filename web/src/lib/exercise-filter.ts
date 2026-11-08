// 種目の検索・タグ絞り込み（種目&ルール / 投稿 / ランキング / 成長記録で共通）
import type { FreeExercise } from './types';
import { categoryIdOfTag, type TagCatalog } from './tag-catalog';

/**
 * 検索用に文字列を正規化する。
 * - NFKC で全角英数・半角カナを揃える
 * - 小文字化
 * - カタカナ → ひらがな（「スクワット」を「すくわっと」でも引けるように）
 */
export function normalizeForSearch(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x60),
    )
    .trim();
}

/** 種目名・ルール・タグのいずれかに検索語（空白区切りは AND）が含まれるか。 */
export function matchesExerciseQuery(
  ex: Pick<FreeExercise, 'name' | 'rule' | 'tags'>,
  query: string,
): boolean {
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const hay = normalizeForSearch(
    [ex.name, ex.rule || '', ...(ex.tags || [])].join('\n'),
  );
  return terms.every((t) => hay.includes(t));
}

export interface ExerciseFilter {
  query: string;
  /** 選択中のタグ（属性ごとに最大1つ）。すべて含む種目に絞る（AND） */
  tags: string[];
}

export const EMPTY_EXERCISE_FILTER: ExerciseFilter = { query: '', tags: [] };

export function isFilterActive(f: ExerciseFilter): boolean {
  return f.query.trim() !== '' || f.tags.length > 0;
}

/**
 * タグの選択を切り替える。同じ属性のタグは1つだけ選べる（選び直すと入れ替わる）。
 * 「胸 × 自重」のように属性をまたいだ組み合わせで絞り込める。
 */
export function toggleFilterTag(
  filter: ExerciseFilter,
  tag: string,
  catalog: TagCatalog,
): ExerciseFilter {
  if (filter.tags.includes(tag)) {
    return { ...filter, tags: filter.tags.filter((t) => t !== tag) };
  }
  const cat = categoryIdOfTag(catalog, tag);
  return {
    ...filter,
    tags: [...filter.tags.filter((t) => categoryIdOfTag(catalog, t) !== cat), tag],
  };
}

/** 検索語とタグで絞り込む。種目が解決できない要素は除外する。 */
export function filterExercises<T>(
  items: T[],
  getEx: (item: T) => FreeExercise | undefined,
  filter: ExerciseFilter,
): T[] {
  return items.filter((item) => {
    const ex = getEx(item);
    if (!ex) return false;
    const exTags = ex.tags || [];
    if (!filter.tags.every((t) => exTags.includes(t))) return false;
    return matchesExerciseQuery(ex, filter.query);
  });
}

/** 種目に付いているタグの一覧（出現順・重複なし）。 */
export function collectExerciseTags(
  exercises: Iterable<Pick<FreeExercise, 'tags'> | undefined>,
): string[] {
  const s = new Set<string>();
  for (const ex of exercises) (ex?.tags || []).forEach((t) => s.add(t));
  return [...s];
}
