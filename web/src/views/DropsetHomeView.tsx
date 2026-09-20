import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDropset } from '../context/DropsetContext';
import { EmptyState, Skeleton } from '../components/ui';
import { TARGET_REPS, formatWeight, progressOf } from '../lib/dropset';
import type { NavKey } from '../shell/BottomNav';
import styles from './DropsetHomeView.module.css';

export default function DropsetHomeView({
  onNavigate,
}: {
  onNavigate: (k: NavKey) => void;
}) {
  const { user, userData, isGuest } = useAuth();
  const { exercises, attempts, loading } = useDropset();

  const name = userData?.userName || (isGuest ? 'ゲスト' : 'ユーザー');

  const rows = useMemo(() => {
    if (!user) return [];
    return Object.entries(exercises)
      .map(([key, ex]) => ({
        key,
        ex,
        p: progressOf(attempts, user.uid, key, ex),
      }))
      .sort((a, b) => {
        // 挑戦中（クリア済みがある）を上に、その中では停滞が長い順
        const ac = a.p.clearedMax == null ? 1 : 0;
        const bc = b.p.clearedMax == null ? 1 : 0;
        if (ac !== bc) return ac - bc;
        if (b.p.stalledCount !== a.p.stalledCount)
          return b.p.stalledCount - a.p.stalledCount;
        return a.ex.name.localeCompare(b.ex.name, 'ja');
      });
  }, [exercises, attempts, user]);

  const { totalAttempts, totalClears } = useMemo(() => {
    if (!user) return { totalAttempts: 0, totalClears: 0 };
    const mine = attempts.filter((a) => a.userId === user.uid);
    return {
      totalAttempts: mine.length,
      totalClears: mine.filter((a) => a.cleared).length,
    };
  }, [attempts, user]);

  return (
    <div className="fade-in">
      <div className={styles.hero}>
        <div>
          <p className={styles.hi}>こんにちは、</p>
          <h1 className={styles.name}>{name} さん</h1>
        </div>
        <span className={styles.modeBadge}>ドロップセット</span>
      </div>

      {loading ? (
        <Skeleton count={3} />
      ) : (
        <>
          <p className={styles.lead}>
            同じ重量で <strong>{TARGET_REPS.join(' - ')}</strong>{' '}
            をこなせたら、その重量はクリア。
          </p>

          <div className={styles.statGrid}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>
                <i className="fa-solid fa-dumbbell" /> 挑戦
              </span>
              <span className={styles.statValue}>
                {totalAttempts}
                <span className={styles.statUnit}>回</span>
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>
                <i className="fa-solid fa-circle-check" /> クリア
              </span>
              <span className={styles.statValue}>
                {totalClears}
                <span className={styles.statUnit}>回</span>
              </span>
            </div>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon="fa-weight-hanging"
              message="種目がまだありません。「種目」タブから追加できます"
            />
          ) : (
            <div className={styles.list}>
              {rows.map(({ key, ex, p }) => (
                <button
                  key={key}
                  className={styles.card}
                  onClick={() => onNavigate('post')}
                >
                  <span className={styles.icon}>
                    <i className={`fa-solid ${ex.icon || 'fa-dumbbell'}`} />
                  </span>
                  <span className={styles.cardMain}>
                    <span className={styles.exName}>{ex.name}</span>
                    <span className={styles.cleared}>
                      {p.clearedMax == null
                        ? 'まだクリアなし'
                        : `クリア済み ${formatWeight(p.clearedMax)}kg`}
                      {p.stalledCount > 0 && (
                        <span className={styles.stall}>
                          {' '}
                          · {p.stalledCount}回停滞中
                        </span>
                      )}
                    </span>
                  </span>
                  <span className={styles.nextWrap}>
                    <span className={styles.nextLabel}>次の挑戦</span>
                    <span className={styles.next}>
                      {formatWeight(p.suggestedWeight)}
                      <span className={styles.nextUnit}>kg</span>
                    </span>
                  </span>
                  <i className={`fa-solid fa-chevron-right ${styles.chev}`} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
