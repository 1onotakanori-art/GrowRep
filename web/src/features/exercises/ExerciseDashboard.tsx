import { useMemo, useState } from 'react';
import { StarRating } from '../../components/ui';
import {
  buildCreatorRanking,
  creatorTier,
  formatProb,
  popularExercises,
  ratingBoostedExercises,
  topRatedExercises,
  trendingExercises,
  type CreatorTier,
  type PostStat,
  type RankedItem,
  type SelectionEstimate,
  SELECTION_TRIALS,
} from '../../lib/exercise-insights';
import type { ExerciseRatingSummary, FreeExerciseMap } from '../../lib/types';
import styles from './ExerciseDashboard.module.css';

interface Props {
  exercises: FreeExerciseMap;
  postStats: Record<string, PostStat>;
  ratings: Record<string, ExerciseRatingSummary>;
  estimates: Record<string, SelectionEstimate>;
  history: Record<string, number>;
}

function RankCard({
  icon,
  title,
  items,
  exercises,
  format,
  empty,
  tone,
}: {
  icon: string;
  title: string;
  items: RankedItem[];
  exercises: FreeExerciseMap;
  format: (v: number) => string;
  empty: string;
  tone?: (v: number) => 'up' | 'down' | undefined;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>
        <i className={`fa-solid ${icon}`} /> {title}
      </div>
      {items.length === 0 ? (
        <div className={styles.empty}>{empty}</div>
      ) : (
        <ol className={styles.rank}>
          {items.map((it, i) => {
            const t = tone?.(it.value);
            return (
              <li key={it.key}>
                <span className={styles.no}>{i + 1}</span>
                <span className={styles.exName}>{exercises[it.key]?.name || it.key}</span>
                <span className={`${styles.val} ${t ? styles[t] : ''}`}>{format(it.value)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

const TIERS: { id: CreatorTier; label: string; icon: string }[] = [
  { id: 'excellent', label: '優良種目クリエイター', icon: 'fa-trophy' },
  { id: 'good', label: '良種目クリエイター', icon: 'fa-thumbs-up' },
  { id: 'bad', label: '要改善クリエイター', icon: 'fa-screwdriver-wrench' },
];

export default function ExerciseDashboard({
  exercises,
  postStats,
  ratings,
  estimates,
  history,
}: Props) {
  const keys = useMemo(() => Object.keys(exercises), [exercises]);
  const creators = useMemo(
    () => buildCreatorRanking(exercises, ratings),
    [exercises, ratings],
  );
  const [openCreator, setOpenCreator] = useState<string | null>(null);
  // 選出確率は親で後から計算されるので、届くまでは「計算中」と出す
  const estimatesReady = Object.keys(estimates).length > 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        <RankCard
          icon="fa-fire"
          title="急増中の種目"
          items={trendingExercises(postStats, keys)}
          exercises={exercises}
          format={(v) => `${v > 0 ? '+' : ''}${v}件/週`}
          tone={(v) => (v > 0 ? 'up' : v < 0 ? 'down' : undefined)}
          empty="投稿データなし"
        />
        <RankCard
          icon="fa-star"
          title="人気の種目（累計）"
          items={popularExercises(postStats, keys)}
          exercises={exercises}
          format={(v) => `${v}件`}
          empty="投稿データなし"
        />
        <RankCard
          icon="fa-medal"
          title="高評価の種目"
          items={topRatedExercises(ratings, keys)}
          exercises={exercises}
          format={(v) => `★${v.toFixed(1)}`}
          empty="評価3件以上の種目なし"
        />
        <RankCard
          icon="fa-dice"
          title="評価で確率UP"
          items={ratingBoostedExercises(estimates, keys)}
          exercises={exercises}
          format={(v) => `+${(v * 100).toFixed(1)}pt`}
          tone={() => 'up'}
          empty={estimatesReady ? '評価3件以上で★3超の種目なし' : '計算中…'}
        />
      </div>
      <p className={styles.note}>
        <i className="fa-solid fa-circle-info" />{' '}
        確率は、次の週間チャレンジの抽選を本番と同じ条件で
        {SELECTION_TRIALS.toLocaleString()}回試した推定値です。
      </p>

      <h3 className={styles.sectionTitle}>
        <i className="fa-solid fa-user-pen" /> 種目クリエイターランキング
      </h3>
      {creators.length === 0 ? (
        <div className={styles.empty}>クリエイターデータなし</div>
      ) : (
        TIERS.map((tier) => {
          const list = creators.filter((c) => creatorTier(c.avgRating) === tier.id);
          if (list.length === 0) return null;
          return (
            <div key={tier.id} className={styles.tier}>
              <div className={`${styles.tierHead} ${styles[`tier_${tier.id}`]}`}>
                <i className={`fa-solid ${tier.icon}`} /> {tier.label}
              </div>
              {list.map((c) => {
                const open = openCreator === c.name;
                return (
                  <div key={c.name} className={styles.creator}>
                    <button
                      className={styles.creatorHead}
                      onClick={() => setOpenCreator(open ? null : c.name)}
                      aria-expanded={open}
                    >
                      <i className={`fa-solid fa-user ${styles.creatorIcon}`} />
                      <span className={styles.creatorName}>{c.name}</span>
                      <span className={styles.creatorRating}>
                        <i className="fa-solid fa-star" /> {c.avgRating!.toFixed(2)}
                        <span className={styles.sub}>（{c.keys.length}種目）</span>
                      </span>
                      <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'} ${styles.chev}`} />
                    </button>
                    {open && (
                      <ul className={styles.creatorList}>
                        {c.keys.map((k) => {
                          const ex = exercises[k];
                          if (!ex) return null;
                          return (
                            <li key={k}>
                              <span className={styles.exName}>
                                <i className={`fa-solid ${ex.icon || 'fa-dumbbell'}`} /> {ex.name}
                              </span>
                              <StarRating
                                avg={ratings[k]?.avgRating}
                                count={ratings[k]?.ratingCount || 0}
                              />
                              <span className={styles.meta}>
                                <span title="投稿数">
                                  <i className="fa-solid fa-pen" /> {postStats[k]?.total || 0}
                                </span>
                                <span title="週間チャレンジに選ばれた回数">
                                  <i className="fa-solid fa-bolt" /> {history[k] || 0}
                                </span>
                                <span title="次の選出確率（推定）">
                                  <i className="fa-solid fa-dice" />{' '}
                                  {ex.excludeFromWeekly
                                    ? '対象外'
                                    : estimatesReady
                                      ? formatProb(estimates[k]?.prob || 0)
                                      : '…'}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}
      {creators.some((c) => c.avgRating == null) && (
        <p className={styles.note}>
          評価のついた種目がまだ無いクリエイター：
          {creators
            .filter((c) => c.avgRating == null)
            .map((c) => c.name)
            .join('、')}
        </p>
      )}
    </div>
  );
}
