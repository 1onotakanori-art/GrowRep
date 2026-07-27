import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useMode } from './ModeContext';
import { useAuth } from './AuthContext';
import { loadFreeExercises } from '../lib/exercises';
import { getUsersMap } from '../lib/users';
import {
  getOrUpdateWeeklyChallenge,
  getWeeklyConfig,
  checkAndFinalizePassedWeeks,
} from '../lib/weekly-engine';
import { loadDailyMissionState } from '../lib/daily-mission-engine';
import type { DailyMissionState } from '../lib/daily-mission';
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
  /** 今日のデイリーミッション（モード非依存の共通機能）。 */
  dailyMission: DailyMissionState | null;
  dailyLoading: boolean;
  reloadDailyMission: () => Promise<void>;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { mode, refreshToken } = useMode();
  const { user } = useAuth();
  const [freeExercises, setFreeExercises] = useState<FreeExerciseMap>({});
  const [usersMap, setUsersMap] = useState<Record<string, UserData>>({});
  const [weeklyChallenge, setWeeklyChallenge] =
    useState<WeeklyChallenge | null>(null);
  const [weeklyConfig, setWeeklyConfig] = useState<WeeklyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyMission, setDailyMission] = useState<DailyMissionState | null>(
    null,
  );
  const [dailyLoading, setDailyLoading] = useState(true);

  const reloadExercises = useCallback(async () => {
    const map = await loadFreeExercises();
    setFreeExercises(map);
  }, []);

  const reloadDailyMission = useCallback(async () => {
    if (!user) return;
    const map = Object.keys(freeExercises).length
      ? freeExercises
      : await loadFreeExercises();
    try {
      setDailyMission(await loadDailyMissionState(user.uid, map, usersMap));
    } catch (e) {
      console.error('[DataProvider] デイリーミッション取得失敗:', e);
    }
  }, [user, freeExercises, usersMap]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setDailyLoading(true);
      try {
        const forceUsers = refreshToken > 0;
        const [exMap, uMap] = await Promise.all([
          loadFreeExercises(),
          getUsersMap(forceUsers),
        ]);
        if (cancelled) return;
        setFreeExercises(exMap);
        setUsersMap(uMap);

        // デイリーミッションはモード非依存。週間の重い処理より先に解決して、
        // 未クリア時の初期タブ切り替えを待たせない。
        if (user) {
          try {
            const daily = await loadDailyMissionState(user.uid, exMap, uMap);
            if (cancelled) return;
            setDailyMission(daily);
          } catch (e) {
            console.error('[DataProvider] デイリーミッション取得失敗:', e);
          }
        }
        if (!cancelled) setDailyLoading(false);

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
        if (!cancelled) {
          setLoading(false);
          setDailyLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, refreshToken, user]);

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
        dailyMission,
        dailyLoading,
        reloadDailyMission,
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
