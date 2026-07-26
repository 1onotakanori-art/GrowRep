import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ViewHeader, Segmented, Skeleton, EmptyState } from '../components/ui';
import { useScores } from '../hooks/useScores';
import { rankUsers } from '../lib/scoring';
import ScoreRadar from '../features/ranking/ScoreRadar';
import styles from './RankingView.module.css';

type Tab = 'total' | 'byExercise';

function medal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
}

export default function RankingView() {
  const { user } = useAuth();
  const { freeExercises } = useData();
  const { records, exerciseKeys, loading, error } = useScores();
  const [tab, setTab] = useState<Tab>('total');
  const [expanded, setExpanded] = useState<string | null>(null);

  const ranked = useMemo(() => rankUsers(records), [records]);

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

      {tab === 'byExercise' && (
        <div className={styles.exList}>
          {exerciseKeys.map((key) => {
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
