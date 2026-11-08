import { useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/** お気に入り種目の Set と切り替え関数（失敗時はトーストを出す）。 */
export function useFavorites() {
  const { favoriteExercises, canFavorite, setFavorite } = useAuth();
  const { toast } = useToast();
  const favorites = useMemo(() => new Set(favoriteExercises), [favoriteExercises]);
  const toggle = useCallback(
    async (key: string) => {
      try {
        await setFavorite(key, !favorites.has(key));
      } catch (e) {
        console.error('[お気に入り] 保存失敗:', e);
        toast('お気に入りを保存できませんでした', 'error');
      }
    },
    [favorites, setFavorite, toast],
  );
  return { favorites, canFavorite, toggle };
}
