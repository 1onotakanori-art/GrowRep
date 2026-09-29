import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useMode } from '../context/ModeContext';
import { ViewHeader, Segmented, Skeleton, EmptyState } from '../components/ui';
import ExerciseSearchBar from '../components/ExerciseSearchBar';
import { useScores } from '../hooks/useScores';
import { rankUsers } from '../lib/scoring';
import {
  EMPTY_EXERCISE_FILTER,
  collectExerciseTags,
  filterExercises,
  type ExerciseFilter,
} from '../lib/exercise-filter';
import ScoreRadar from '../features/ranking/ScoreRadar';
import styles from './RankingView.module.css';

type Tab = 'total' | 'byExercise';

function medal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
}

export default function RankingView() {
  const { user } = useAuth();
  const { freeExercises } = useData();
  const { mode } = useMode();
  const { records, exerciseKeys, loading, error } = useScores();
  // フリーモードはランキングを開いた時に種目別を先に見せる
  const [tab, setTab] = useState<Tab>(mode === 'free' ? 'byExercise' : 'total');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<ExerciseFilter>(EMPTY_EXERCISE_FILTER);
  const [recordedOnly, setRecordedOnly] = useState(false);

  // ランキング表示中にモードを切り替えた場合も、そのモードの初期タブに戻す
  useEffect(() => {
    setTab(mode === 'free' ? 'byExercise' : 'total');
  }, [mode]);

  const ranked = useMemo(() => rankUsers(records), [records]);

  // 種目別の検索・絞り込みはフリーモードのみ（週間は数種目なので不要）
  const searchable = mode === 'free';
  const tags = useMemo(
    () =>
      searchable
        ? collectExerciseTags(exerciseKeys.map((k) => freeExercises[k]))
        : [],
    [searchable, exerciseKeys, freeExercises],
  );
  const recordedKeys = useMemo(() => {
    const s = new Set<string>();
    Object.values(records).forEach((rec) =>
      Object.entries(rec.exercises).forEach(([k, v]) => {
        if ((v || 0) > 0) s.add(k);
      }),
    );
    return s;
  }, [records]);
  const visibleKeys = useMemo(() => {
    if (!searchable) return exerciseKeys;
    const keys = filterExercises(exerciseKeys, (k) => freeExercises[k], filter);
    return recordedOnly ? keys.filter((k) => recordedKeys.has(k)) : keys;
  }, [searchable, exerciseKeys, freeExercises, filter, recordedOnly, recordedKeys]);

  if (loading) return <Skeleton count={5} />;
  if (error)
    return <EmptyState icon="fa-triangle-exclamation" message="読み込みに失敗しました" />;
  if (ranked.length === 0)
    return <EmptyState icon="fa-ranking-star" message="まだ記録がありません" />;

  return (
    <div className="fade-in">
      <ViewHeader icon="fa-ranking-star" title="ランキング" />
      <Segmented<Tab>
        options={[
          { value: 'total', label: '総合得点' },
          { value: 'byExercise', label: '種目別' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'total' && (
        <>
          <ScoreRadar records={records} exerciseKeys={exerciseKeys} />
          <div className={styles.board}>
            {ranked.map(({ userId, rec, rank }) => {
              const isMe = userId === user?.uid;
              const open = expanded === userId;
              return (
                <div
                  key={userId}
                  className={`${styles.row} ${isMe ? styles.me : ''} ${rank <= 3 ? styles.podium : ''}`}
                >
                  <button
                    className={styles.rowHead}
                    onClick={() => setExpanded(open ? null : userId)}
                  >
                    <span className={`${styles.rank} ${styles['r' + Math.min(rank, 4)]}`}>
                      {medal(rank)}
                    </span>
                    <span className={styles.name}>
                      {rec.userName}
                      {isMe && <span className={styles.youTag}>YOU</span>}
                    </span>
                    {(rec.streakBonus || 0) > 0 && (
                      <span className={styles.streak} title={`${rec.streakDays}日連続`}>
                        🔥{rec.streakDays}
                      </span>
                    )}
                    <span className={styles.score}>
                      {rec.totalScore.toFixed(1)}
                      <span className={styles.pct}>%</span>
                    </span>
                    <i
                      className={`fa-solid fa-chevron-${open ? 'up' : 'down'} ${styles.chev}`}
                    />
                  </button>
                  {open && (
                    <div className={styles.breakdown}>
                      {exerciseKeys.map((key) => {
                        const ex = freeExercises[key];
                        if (!ex) return null;
                        const val = rec.exercises[key] || 0;
                        const pct = rec.scores[key] || 0;
                        return (
                          <div key={key} className={styles.bItem}>
                            <span className={styles.bName}>{ex.name}</span>
                            <span className={styles.bVal}>
                              {val}
                              {ex.barbarian ? '秒' : ''}
                            </span>
                            <div className={styles.bBarWrap}>
                              <div
                                className={styles.bBar}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className={styles.bPct}>{pct.toFixed(0)}%</span>
                          </div>
                        );
                      })}
                      {(rec.streakBonus || 0) > 0 && (
                        <div className={styles.streakRow}>
                          <i className="fa-solid fa-fire" /> ストリーク加点 +
                          {rec.streakBonus}（{rec.streakDays}日連続）
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'byExercise' && searchable && (
        <ExerciseSearchBar
          value={filter}
          onChange={setFilter}
          tags={tags}
          resultCount={visibleKeys.length}
          narrowed={recordedOnly}
          extra={
            <label className={styles.recordedToggle}>
              <input
                type="checkbox"
                checked={recordedOnly}
                onChange={(e) => setRecordedOnly(e.target.checked)}
              />
              記録のある種目のみ
            </label>
          }
        />
      )}

      {tab === 'byExercise' && searchable && visibleKeys.length === 0 && (
        <EmptyState icon="fa-magnifying-glass" message="該当する種目がありません" />
      )}

      {tab === 'byExercise' && (
        <div className={styles.exList}>
          {visibleKeys.map((key) => {
            const ex = freeExercises[key];
            if (!ex) return null;
            const isBarbarian = !!ex.barbarian;
            const board = Object.entries(records)
              .map(([uid, rec]) => ({
                uid,
                name: rec.userName,
                value: rec.exercises[key] || 0,
              }))
              .filter((x) => x.value > 0)
              .sort((a, b) =>
                isBarbarian ? a.value - b.value : b.value - a.value,
              );
            return (
              <div key={key} className={styles.exBlock}>
                <div className={styles.exBlockHead}>
                  <i className={`fa-solid ${ex.icon || 'fa-dumbbell'}`} />
                  <span>{ex.name}</span>
                  {isBarbarian && (
                    <span className={styles.taBadge}>
                      <i className="fa-solid fa-stopwatch" /> タイム
                    </span>
                  )}
                </div>
                {board.length === 0 ? (
                  <p className={styles.noRec}>記録なし</p>
                ) : (
                  board.slice(0, 5).map((b, i) => (
                    <div
                      key={b.uid}
                      className={`${styles.exRow} ${b.uid === user?.uid ? styles.me : ''}`}
                    >
                      <span className={`${styles.exRank} ${styles['r' + Math.min(i + 1, 4)]}`}>
                        {medal(i + 1)}
                      </span>
                      <span className={styles.exName}>{b.name}</span>
                      <span className={styles.exVal}>
                        {b.value}
                        {isBarbarian ? '秒' : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
