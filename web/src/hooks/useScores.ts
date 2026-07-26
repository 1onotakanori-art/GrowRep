import { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { useMode } from '../context/ModeContext';
import { loadFreeScores, loadWeeklyScores } from '../lib/load-scores';
import type { UserRecords } from '../lib/scoring';

export interface ScoresState {
  records: UserRecords;
  exerciseKeys: string[]; // 集計対象の種目キー（順序保持）
  loading: boolean;
  error: boolean;
}

/** 現在のモードに応じて総合スコアを読み込む。refreshToken で再取得。 */
export function useScores(): ScoresState {
  const { mode, refreshToken } = useMode();
  const { freeExercises, weeklyChallenge, weeklyConfig } = useData();
  const [state, setState] = useState<ScoresState>({
    records: {},
    exerciseKeys: [],
    loading: true,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: false }));
    (async () => {
      try {
        if (mode === 'weekly') {
          if (!weeklyChallenge || !weeklyConfig) return;
          const { records, exerciseKeys } = await loadWeeklyScores(
            freeExercises,
            weeklyChallenge,
            weeklyConfig,
          );
          if (!cancelled)
            setState({ records, exerciseKeys, loading: false, error: false });
        } else {
          const records = await loadFreeScores(freeExercises);
          if (!cancelled)
            setState({
              records,
              exerciseKeys: Object.keys(freeExercises),
              loading: false,
              error: false,
            });
        }
      } catch (e) {
        console.error('[useScores] 読み込み失敗:', e);
        if (!cancelled)
          setState({ records: {}, exerciseKeys: [], loading: false, error: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // freeExercises / weeklyChallenge はオブジェクト参照が変わると再取得
  }, [mode, refreshToken, freeExercises, weeklyChallenge, weeklyConfig]);

  return state;
}
