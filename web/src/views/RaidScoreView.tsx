import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useMode } from '../context/ModeContext';
import {
  loadRaidScoreboard,
  type RaidScoreboard,
} from '../lib/daily-mission-engine';
import {
  RAID_MODE_LABEL,
  RAID_POINTS_PER_DAY,
  RAID_TOTAL_DAYS,
  formatRaidPoints,
  raidContributionRatio,
} from '../lib/raid-mode';
import {
  formatDailyCount,
  formatDailyDateLabel,
  guessExerciseUnit,
  truncateLabelName,
} from '../lib/daily-mission';
import { EmptyState, Skeleton, ViewHeader } from '../components/ui';
import styles from './RaidScoreView.module.css';

export default function RaidScoreView() {
  const { user } = useAuth();
  const { freeExercises, usersMap } = useData();
  const { refreshToken } = useMode();
  const [board, setBoard] = useState<RaidScoreboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      setLoading(true);
      try {
        const b = await loadRaidScoreboard(user.uid, freeExercises, usersMap);
        if (!cancelled) setBoard(b);
      } catch (e) {
        console.error('[レイド] 得点の読み込みに失敗:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, freeExercises, usersMap, refreshToken]);

  if (loading) {
    return (
      <div className="fade-in">
        <ViewHeader icon="fa-ranking-star" title="積み上げ得点" />
        <Skeleton count={2} />
      </div>
    );
  }

  if (!board || board.playedDays === 0) {
    return (
      <div className="fade-in">
        <ViewHeader icon="fa-ranking-star" title="積み上げ得点" />
        <EmptyState icon="fa-dragon" message="レイドはまだ始まっていません" />
      </div>
    );
  }

  const maxPoints = board.standings[0]?.totalPoints || 0;

  return (
    <div className="fade-in">
      <ViewHeader
        icon="fa-ranking-star"
        title="積み上げ得点"
        action={
          <span className={styles.count}>
            {board.playedDays}/{RAID_TOTAL_DAYS} 日終了
          </span>
        }
      />

      <p className={styles.lead}>
        <span className={styles.badge}>
          <i className="fa-solid fa-dragon" /> {RAID_MODE_LABEL}
        </span>
        その日の合計に占める貢献度（％）をそのまま点にして、開催期間ぶん積み上げます。
        1日の持ち点は{RAID_POINTS_PER_DAY}点で、参加した人で分け合う形です。
        たくさんやった人ほど点は増えますが、少人数の日に参加するほど1回あたりの重みも大きくなります。
      </p>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span>
            <i className="fa-solid fa-ranking-star" /> 総合
          </span>
        </div>
        {board.standings.length === 0 ? (
          <p className={styles.empty}>まだ誰も投稿していません。</p>
        ) : (
          <ul className={styles.rankList}>
            {board.standings.map((s) => (
              <li
                key={s.userId}
                className={`${styles.rankRow} ${s.isMe ? styles.rankMe : ''}`}
              >
                <span className={styles.rankNo}>
                  {s.rank === 1
                    ? '🥇'
                    : s.rank === 2
                      ? '🥈'
                      : s.rank === 3
                        ? '🥉'
                        : s.rank}
                </span>
                <span className={styles.rankName}>
                  {s.userName}
                  <span className={styles.rankDays}>{s.activeDays}日参加</span>
                </span>
                <span className={styles.rankBarWrap}>
                  <span
                    className={styles.rankBar}
                    style={{
                      width: `${raidContributionRatio(s.totalPoints, maxPoints) * 100}%`,
                    }}
                  />
                </span>
                <span className={styles.rankPt}>
                  {formatRaidPoints(s.totalPoints)}
                  <span className={styles.rankPtUnit}>点</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <span>
            <i className="fa-solid fa-calendar-day" /> 日ごとの結果
          </span>
        </div>
        <div className={styles.dayList}>
          {board.days.map((d) => {
            const ex = d.exerciseKey ? freeExercises[d.exerciseKey] : undefined;
            const unit = guessExerciseUnit(ex?.name || '');
            const percent = Math.min(
              100,
              Math.round(d.goal > 0 ? (d.totalValue / d.goal) * 100 : 0),
            );
            return (
              <div
                key={d.dateKey}
                className={`${styles.dayCard} ${d.cleared ? styles.dayDone : ''}`}
              >
                <div className={styles.dayHead}>
                  <span className={styles.dayLabel}>
                    Day {d.day}
                    <span className={styles.dayDate}>
                      {formatDailyDateLabel(d.dateKey)}
                    </span>
                  </span>
                  <span className={styles.dayStatus}>
                    {d.cleared ? (
                      <>
                        <i className="fa-solid fa-circle-check" /> 討伐
                      </>
                    ) : (
                      `${percent}%`
                    )}
                  </span>
                </div>
                <div className={styles.dayBody}>
                  <span className={styles.dayEx}>
                    <i className={`fa-solid ${ex?.icon || 'fa-dumbbell'}`} />
                    {ex?.name || '種目未定'}
                  </span>
                  <span className={styles.dayTotal}>
                    {formatDailyCount(d.totalValue)} /{' '}
                    {formatDailyCount(d.goal)}
                    {unit}
                  </span>
                </div>
                <div className={styles.dayTops}>
                  {d.entries.length === 0 ? (
                    <span className={styles.dayEmpty}>投稿なし</span>
                  ) : (
                    d.entries.slice(0, 3).map((e) => (
                      <span
                        key={e.userId}
                        className={`${styles.dayTop} ${e.isMe ? styles.dayTopMe : ''}`}
                      >
                        {truncateLabelName(e.userName)}{' '}
                        {formatRaidPoints(e.points)}点
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className={styles.note}>
          各日の上位3人と、その日の点を表示しています。
        </p>
      </div>
    </div>
  );
}
