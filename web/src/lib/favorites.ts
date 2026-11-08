// お気に入り種目（users/{uid}.favoriteExercises）の並べ替え。
// 種目・投稿・成長記録で「お気に入りを先頭に、残りは元の順」に並べるのに使う。

/** お気に入りを先頭へ寄せる安定ソート。元の配列は変更しない。 */
export function favoritesFirst<T>(
  items: T[],
  getKey: (item: T) => string,
  favorites: ReadonlySet<string>,
): T[] {
  if (favorites.size === 0) return items;
  const fav: T[] = [];
  const rest: T[] = [];
  for (const it of items) (favorites.has(getKey(it)) ? fav : rest).push(it);
  return fav.concat(rest);
}

/** お気に入りの追加・解除後の配列（重複なし、追加は末尾）。 */
export function toggleInList(list: string[], key: string, on: boolean): string[] {
  const without = list.filter((k) => k !== key);
  return on ? [...without, key] : without;
}
