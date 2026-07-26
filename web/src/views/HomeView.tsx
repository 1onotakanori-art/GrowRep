import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useMode } from '../context/ModeContext';
import { useScores } from '../hooks/useScores';
import { rankUsers } from '../lib/scoring';
import { getActiveWeeklyKeys } from '../lib/time-jst';
import type { NavKey } from '../shell/BottomNav';
import { Skeleton } from '../components/ui';
import styles from './HomeView.module.css';

export default function HomeView({
  onNavigate,
}: {
  onNavigate: (k: NavKey) => void;
}) {
  const { user, userData, isGuest } = useAuth();
  const { mode } = useMode();
  const { freeExercises, weeklyChallenge } = useData();
  const { records, loading } = useScores();

  const name = userData?.userName || (isGuest ? 'ゲスト' : 'ユーザー');

  const { myRank, myScore, myStreak, total } = useMemo(() => {
    const ranked = rankUsers(records);
    const mine = ranked.find((r) => r.userId === user?.uid);
    return {
      myRank: mine?.rank ?? null,
      myScore: mine?.rec.totalScore ?? 0,
      myStreak: mine?.rec.streakDays ?? 0,
      total: ranked.length,
    };
  }, [records, user]);

  const activeKeys = weeklyChallenge
    ? getActiveWeeklyKeys(weeklyChallenge.exercises)
    : [];
  const lockedCount = weeklyChallenge
    ? weeklyChallenge.exercises.length - activeKeys.length
    : 0;

  return (
    <div className="fade-in">
      <div className={styles.hero}>
        <div>
          <p className={styles.hi}>こんにちは、</p>
          <h1 className={styles.name}>{name} さん</h1>
        </div>
        <span className={styles.modeBadge}>
          {mode === 'weekly' ? '週間チャレンジ' : 'フリーモード'}
        </span>
      </div>

      {loading ? (
        <Skeleton count={2} />
      ) : (
        <>
          <div className={styles.statGrid}>
            <div className={`${styles.stat} ${styles.statRank}`}>
              <span className={styles.statLabel}>
                <i className="fa-solid fa-ranking-star" /> 順位
              </span>
              <span className={styles.statValue}>
                {myRank ? (
                  <>
                    {myRank}
                    <span className={styles.statUnit}>/ {total}位</span>
                  </>
                ) : (
                  '—'
                )}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>
                <i className="fa-solid fa-bolt" /> 総合得点
              </span>
              <span className={styles.statValue}>
                {myScore.toFixed(1)}
                <span className={styles.statUnit}>%</span>
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>
                <i className="fa-solid fa-fire" /> ストリーク
              </span>
              <span className={styles.statValue}>
                {myStreak}
                <span className={styles.statUnit}>日</span>
              </span>
            </div>
          </div>

          {mode === 'weekly' && weeklyChallenge && (
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <span>
                  <i className="fa-solid fa-trophy" /> 今週のチャレンジ
                </span>
                <button
                  className={styles.link}
                  onClick={() => onNavigate('center')}
                >
                  詳細 <i className="fa-solid fa-chevron-right" />
                </button>
              </div>
              <div className={styles.chips}>
                {activeKeys.map((k) => (
                  <span key={k} className={styles.exChip}>
                    <i
                      className={`fa-solid ${freeExercises[k]?.icon || 'fa-dumbbell'}`}
                    />
                    {freeExercises[k]?.name || k}
                  </span>
                ))}
                {lockedCount > 0 && (
                  <span className={styles.lockChip}>
                    <i className="fa-solid fa-lock" /> ？？？ ×{lockedCount}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className={styles.actions}>
            <button
              className={styles.actionPrimary}
              onClick={() => onNavigate('post')}
            >
              <i className="fa-solid fa-pen-to-square" />
              記録を投稿
            </button>
            <button
              className={styles.actionSecondary}
              onClick={() => onNavigate('ranking')}
            >
              <i className="fa-solid fa-ranking-star" />
              ランキング
            </button>
          </div>
        </>
      )}
    </div>
  );
}
