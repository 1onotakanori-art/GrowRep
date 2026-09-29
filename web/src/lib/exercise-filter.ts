// 種目の検索・タグ絞り込み（種目&ルール / 投稿 / ランキング / 成長記録で共通）
import type { FreeExercise } from './types';

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
  tag: string | null;
}

export const EMPTY_EXERCISE_FILTER: ExerciseFilter = { query: '', tag: null };

export function isFilterActive(f: ExerciseFilter): boolean {
  return f.query.trim() !== '' || f.tag !== null;
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
    if (filter.tag && !(ex.tags || []).includes(filter.tag)) return false;
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
