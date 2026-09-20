// ドロップセットモードのデータ（種目マスタ + 挑戦記録）をまとめて供給する。
// ホーム / 投稿 / ランキング / 種目 / マイページの5画面が同じデータを見るため、
// 画面ごとに取りに行かず、ここで1回だけ読む。
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useMode } from './ModeContext';
import { useAuth } from './AuthContext';
import {
  getDropsetPosts,
  loadDropsetExercises,
  toAttempts,
} from '../lib/dropset-engine';
import type { DropsetAttempt } from '../lib/dropset';
import type { DropsetExerciseMap, DropsetPost } from '../lib/types';

interface DropsetCtx {
  exercises: DropsetExerciseMap;
  setExercises: (m: DropsetExerciseMap) => void;
  posts: DropsetPost[];
  /** 純ロジック（lib/dropset.ts）に渡す形に均した挑戦記録 */
  attempts: DropsetAttempt[];
  loading: boolean;
  error: boolean;
  reload: () => Promise<void>;
}

const Ctx = createContext<DropsetCtx | null>(null);

export function DropsetProvider({ children }: { children: ReactNode }) {
  const { mode, refreshToken } = useMode();
  const { user } = useAuth();
  const [exercises, setExercises] = useState<DropsetExerciseMap>({});
  const [posts, setPosts] = useState<DropsetPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchAll = useCallback(async () => {
    const [exMap, postList] = await Promise.all([
      loadDropsetExercises(),
      getDropsetPosts(),
    ]);
    setExercises(exMap);
    setPosts(postList);
  }, []);

  const reload = useCallback(async () => {
    try {
      await fetchAll();
      setError(false);
    } catch (e) {
      console.error('[DropsetProvider] 再読み込み失敗:', e);
      setError(true);
    }
  }, [fetchAll]);

  // 種目マスタはドキュメント1件なので、どのモードでも読む。
  // フィードには全モードでドロップセットの投稿が流れるため、種目名の解決に要る。
  useEffect(() => {
    if (!user || mode === 'dropset') return;
    let cancelled = false;
    (async () => {
      try {
        const exMap = await loadDropsetExercises();
        if (!cancelled) setExercises(exMap);
      } catch (e) {
        console.warn('[DropsetProvider] 種目の取得に失敗:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, refreshToken, user]);

  // 挑戦記録はドロップセットモードのときだけ。他モードでは使わないので読まない
  useEffect(() => {
    if (mode !== 'dropset' || !user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        await fetchAll();
        if (!cancelled) setError(false);
      } catch (e) {
        console.error('[DropsetProvider] 初期ロード失敗:', e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, refreshToken, user, fetchAll]);

  const attempts = useMemo(() => toAttempts(posts), [posts]);

  return (
    <Ctx.Provider
      value={{
        exercises,
        setExercises,
        posts,
        attempts,
        loading,
        error,
        reload,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDropset(): DropsetCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDropset must be used within DropsetProvider');
  return ctx;
}
