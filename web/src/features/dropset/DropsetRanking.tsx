import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useDropset } from '../../context/DropsetContext';
import { EmptyState, Skeleton, ViewHeader } from '../../components/ui';
import {
  TARGET_REPS,
  formatWeight,
  progressOf,
  rankByClearedWeight,
} from '../../lib/dropset';
import { resolveUserName } from '../../lib/users';
import styles from './DropsetRanking.module.css';

function medal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
}

export default function DropsetRanking() {
  const { user } = useAuth();
  const { usersMap } = useData();
  const { exercises, attempts, loading, error } = useDropset();

  const list = useMemo(
    () =>
      Object.entries(exercises).sort(([, a], [, b]) =>
        a.name.localeCompare(b.name, 'ja'),
      ),
    [exercises],
  );

  if (loading) return <Skeleton count={4} />;
  if (error)
    return (
      <EmptyState
        icon="fa-triangle-exclamation"
        message="読み込みに失敗しました"
      />
    );
  if (list.length === 0)
    return (
      <EmptyState
        icon="fa-weight-hanging"
        message="種目がまだありません。「種目」タブから追加できます"
      />
    );

  return (
    <div className="fade-in">
      <ViewHeader icon="fa-ranking-star" title="クリア重量ランキング" />
      <p className={styles.lead}>
        <strong>{TARGET_REPS.join(' - ')}</strong>{' '}
        を達成した重量のいちばん重いもので並んでいます。
      </p>

      <div className={styles.sections}>
        {list.map(([key, ex]) => {
          const rows = rankByClearedWeight(attempts, key);
          const mine = user ? progressOf(attempts, user.uid, key, ex) : null;
          return (
            <div key={key} className={styles.section}>
              <div className={styles.secHead}>
                <span className={styles.icon}>
                  <i className={`fa-solid ${ex.icon || 'fa-dumbbell'}`} />
                </span>
                <span className={styles.secName}>{ex.name}</span>
              </div>

              {rows.length === 0 ? (
                <p className={styles.noRecord}>
                  まだ誰もクリアしていません。最初の1人になろう
                </p>
              ) : (
                <div className={styles.board}>
                  {rows.map((r, i) => {
                    const rank = i + 1;
                    const isMe = r.userId === user?.uid;
                    return (
                      <div
                        key={r.userId}
                        className={`${styles.row} ${isMe ? styles.me : ''} ${
                          rank <= 3 ? styles.podium : ''
                        }`}
                      >
                        <span
                          className={`${styles.rank} ${styles['r' + Math.min(rank, 4)]}`}
                        >
                          {medal(rank)}
                        </span>
                        <span className={styles.userName}>
                          {resolveUserName(usersMap, r.userId)}
                        </span>
                        <span className={styles.weight}>
                          {formatWeight(r.weight)}
                          <span className={styles.unit}>kg</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {mine && mine.clearedMax == null && (
                <p className={styles.myNext}>
                  <i className="fa-solid fa-flag-checkered" /> 自分の次の挑戦:{' '}
                  <strong>{formatWeight(mine.suggestedWeight)}kg</strong>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
