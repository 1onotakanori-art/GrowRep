import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useMode } from './ModeContext';
import { loadFreeExercises } from '../lib/exercises';
import { getUsersMap } from '../lib/users';
import {
  getOrUpdateWeeklyChallenge,
  getWeeklyConfig,
  checkAndFinalizePassedWeeks,
} from '../lib/weekly-engine';
import type {
  FreeExerciseMap,
  UserData,
  WeeklyChallenge,
  WeeklyConfig,
} from '../lib/types';

interface DataCtx {
  freeExercises: FreeExerciseMap;
  setFreeExercises: (m: FreeExerciseMap) => void;
  usersMap: Record<string, UserData>;
  weeklyChallenge: WeeklyChallenge | null;
  weeklyConfig: WeeklyConfig | null;
  loading: boolean;
  reloadExercises: () => Promise<void>;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { mode, refreshToken } = useMode();
  const [freeExercises, setFreeExercises] = useState<FreeExerciseMap>({});
  const [usersMap, setUsersMap] = useState<Record<string, UserData>>({});
  const [weeklyChallenge, setWeeklyChallenge] =
    useState<WeeklyChallenge | null>(null);
  const [weeklyConfig, setWeeklyConfig] = useState<WeeklyConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadExercises = useCallback(async () => {
    const map = await loadFreeExercises();
    setFreeExercises(map);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const forceUsers = refreshToken > 0;
        const [exMap, uMap] = await Promise.all([
          loadFreeExercises(),
          getUsersMap(forceUsers),
        ]);
        if (cancelled) return;
        setFreeExercises(exMap);
        setUsersMap(uMap);

        if (mode === 'weekly') {
          const cfg = await getWeeklyConfig();
          const challenge = await getOrUpdateWeeklyChallenge(exMap);
          if (cancelled) return;
          setWeeklyConfig(cfg);
          setWeeklyChallenge(challenge);
          // 過去週の詳細バックフィル（非同期・失敗しても無視）
          checkAndFinalizePassedWeeks(exMap).catch(() => {});
        } else {
          setWeeklyChallenge(null);
        }
      } catch (e) {
        console.error('[DataProvider] 初期ロード失敗:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, refreshToken]);

  return (
    <Ctx.Provider
      value={{
        freeExercises,
        setFreeExercises,
        usersMap,
        weeklyChallenge,
        weeklyConfig,
        loading,
        reloadExercises,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useData(): DataCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
