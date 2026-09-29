import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import {
  activeWeeklyKeysOf,
  isRevealUnlockedJST,
  isPredictionOpenJST,
  buildChampionDocMeta,
  formatWeeklyPeriodLabel,
} from '../../lib/time-jst';
import {
  getWeeklyPredictionsMap,
  saveMyPrediction,
} from '../../lib/weekly-engine';
import {
  RAID_MODE_LABEL,
  RAID_TITLE,
  WEEKLY_PAUSE_LABEL,
  WEEKLY_PAUSE_NOTE,
  WEEKLY_PAUSE_RESUME_NOTE,
} from '../../lib/raid-mode';
import {
  getExerciseRatingSummaries,
  getUserExerciseRatings,
} from '../../lib/ratings';
import type { ExerciseRatingSummary } from '../../lib/types';
import { EmptyState, Barbadge, StarRating } from '../../components/ui';
import RatingModal from '../exercises/RatingModal';
import ReviewsModal from '../exercises/ReviewsModal';
import styles from './ThisWeek.module.css';

// Sunday 17:00 JST 起点から水曜13:00 JST（=+68h）を解禁時刻とする
const REVEAL_OFFSET_MS = 68 * 60 * 60 * 1000;

function useCountdown(target: number | null): string {
  const [, tick] = useState(0);
  useEffect(() => {
    if (target == null) return;
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [target]);
  if (target == null) return '';
  const diff = Math.max(0, target - Date.now());
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}時間${String(m).padStart(2, '0')}分${String(s).padStart(2, '0')}秒`;
}

export default function ThisWeek() {
  const { user, userData } = useAuth();
  const { freeExercises, weeklyChallenge, weeklyConfig, usersMap } = useData();
  const { toast } = useToast();
  const [myPrediction, setMyPrediction] = useState<string | null>(null);
  const [savingPred, setSavingPred] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, ExerciseRatingSummary>>({});
  const [myRatings, setMyRatings] = useState<Record<string, boolean>>({});
  const [ratingsVersion, setRatingsVersion] = useState(0);
  const [ratingModal, setRatingModal] = useState<string | null>(null);
  const [reviewsModal, setReviewsModal] = useState<string | null>(null);

  const weekStartMs = weeklyChallenge?.weekStart.getTime() ?? null;
  const revealTarget =
    weekStartMs != null && !isRevealUnlockedJST()
      ? weekStartMs + REVEAL_OFFSET_MS
      : null;
  const countdown = useCountdown(revealTarget);

  useEffect(() => {
    if (weekStartMs == null) return;
    (async () => {
      const weeks = await getWeeklyPredictionsMap();
      const mine = weeks[weekStartMs]?.[user?.uid || ''];
      if (mine) setMyPrediction(mine);
    })();
  }, [weekStartMs, user]);

  const activeKeys = useMemo(
    () => activeWeeklyKeysOf(weeklyChallenge),
    [weeklyChallenge],
  );
  const lockedCount = weeklyChallenge
    ? weeklyChallenge.exercises.length - activeKeys.length
    : 0;

  // 解禁済み種目の評価サマリーと自分の評価有無（フリーモードの種目一覧と同じ取得方法）
  useEffect(() => {
    if (activeKeys.length === 0) return;
    (async () => {
      const [sum, mine] = await Promise.all([
        getExerciseRatingSummaries(activeKeys),
        getUserExerciseRatings(activeKeys),
      ]);
      setSummaries(sum);
      const mineMap: Record<string, boolean> = {};
      Object.keys(mine).forEach((k) => (mineMap[k] = true));
      setMyRatings(mineMap);
    })();
  }, [activeKeys, ratingsVersion]);

  // 夏休み休止週。種目が選ばれていないのは「準備中」ではないので別表示にする
  if (weeklyChallenge?.paused) {
    const { monJST: pauseMon, friJST: pauseFri } = buildChampionDocMeta(
      weeklyChallenge.weekStart,
    );
    return (
      <div className={styles.wrap}>
        <div className={styles.pauseCard}>
          <span className={styles.pauseBadge}>
            <i className="fa-solid fa-umbrella-beach" />{' '}
            {weeklyChallenge.pauseLabel || WEEKLY_PAUSE_LABEL}
          </span>
          <span className={styles.periodLabel}>
            <i className="fa-solid fa-calendar-week" />{' '}
            {formatWeeklyPeriodLabel(pauseMon, pauseFri)}
          </span>
          <p className={styles.pauseNote}>{WEEKLY_PAUSE_NOTE}</p>
          <p className={styles.pauseNote}>{WEEKLY_PAUSE_RESUME_NOTE}</p>
          <p className={styles.pauseRaid}>
            <i className="fa-solid fa-dragon" /> この期間は{RAID_MODE_LABEL}
            「{RAID_TITLE}」を開催中。デイリータブから参戦できます。
          </p>
        </div>
      </div>
    );
  }

  if (!weeklyChallenge || weeklyChallenge.exercises.length === 0) {
    return (
      <EmptyState icon="fa-hourglass-half" message="今週のチャレンジを準備中です" />
    );
  }

  const { monJST, friJST } = buildChampionDocMeta(weeklyChallenge.weekStart);
  const periodLabel = formatWeeklyPeriodLabel(monJST, friJST);
  const predictionOpen = !!weeklyConfig?.enablePrediction && isPredictionOpenJST();

  async function pick(uid: string) {
    if (weekStartMs == null) return;
    setSavingPred(true);
    const ok = await saveMyPrediction(weekStartMs, uid);
    if (ok) {
      setMyPrediction(uid);
      toast('予想を保存しました', 'success');
    } else {
      toast('予想の受付は終了しました', 'error');
    }
    setSavingPred(false);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.periodCard}>
        {weeklyChallenge.isManualOverride && (
          <span className={styles.eventBadge}>
            <i className="fa-solid fa-star" />{' '}
            {weeklyChallenge.overrideLabel || '特別イベント'}
          </span>
        )}
        <span className={styles.periodLabel}>
          <i className="fa-solid fa-calendar-week" /> {periodLabel}
        </span>
      </div>

      <div className={styles.exList}>
        {activeKeys.map((k, i) => {
          const ex = freeExercises[k];
          if (!ex) return null;
          return (
            <div key={k} className={styles.exCard}>
              <div className={styles.exHead}>
                <span className={styles.exNum}>{i + 1}</span>
                <span className={styles.exIcon}>
                  <i className={`fa-solid ${ex.icon || 'fa-dumbbell'}`} />
                </span>
                <div className={styles.exBody}>
                  <span className={styles.exName}>{ex.name}</span>
                  <StarRating
                    avg={summaries[k]?.avgRating}
                    count={summaries[k]?.ratingCount || 0}
                  />
                </div>
                {ex.barbarian && <Barbadge />}
              </div>
              {ex.rule && <p className={styles.exRuleFull}>{ex.rule}</p>}
              <div className={styles.exActions}>
                <button
                  className={styles.rateBtn}
                  onClick={() => setRatingModal(k)}
                >
                  <i className="fa-solid fa-star" />{' '}
                  {myRatings[k] ? '評価を変更' : '評価する'}
                </button>
                <button
                  className={styles.reviewBtn}
                  onClick={() => setReviewsModal(k)}
                >
                  <i className="fa-solid fa-comments" /> レビュー
                </button>
              </div>
            </div>
          );
        })}

        {lockedCount > 0 &&
          Array.from({ length: lockedCount }).map((_, i) => (
            <div key={`lock-${i}`} className={styles.lockedCard}>
              <span className={styles.exNum}>{activeKeys.length + i + 1}</span>
              <span className={styles.lockIcon}>
                <i className="fa-solid fa-lock" />
              </span>
              <div className={styles.exBody}>
                <span className={styles.lockName}>？？？</span>
                <span className={styles.exRule}>
                  解禁まで {countdown || '水曜13:00'}
                </span>
              </div>
            </div>
          ))}
      </div>

      {weeklyConfig?.enableStreak && (
        <div className={styles.streakNote}>
          <i className="fa-solid fa-fire" /> 平日に連続で投稿すると最大+
          {weeklyConfig.streakBonusCap}点のストリークボーナス！
        </div>
      )}

      {weeklyConfig?.enablePrediction && (
        <div className={styles.predCard}>
          <div className={styles.predHead}>
            <i className="fa-solid fa-crystal-ball" /> チャンプ予想
            {!predictionOpen && (
              <span className={styles.predClosed}>受付終了</span>
            )}
          </div>
          <p className={styles.predNote}>
            今週のチャンプを予想しよう（火曜24:00まで変更可）
          </p>
          <div className={styles.predUsers}>
            {Object.entries(usersMap).map(([uid, u]) => (
              <button
                key={uid}
                className={myPrediction === uid ? styles.predOn : styles.predBtn}
                disabled={!predictionOpen || savingPred}
                onClick={() => pick(uid)}
              >
                {u.userName || 'ユーザー'}
              </button>
            ))}
          </div>
        </div>
      )}

      {ratingModal && (
        <RatingModal
          exerciseKey={ratingModal}
          exerciseName={freeExercises[ratingModal]?.name || ''}
          userName={userData?.userName || user?.email || '匿名'}
          onClose={() => setRatingModal(null)}
          onChanged={() => setRatingsVersion((v) => v + 1)}
        />
      )}
      {reviewsModal && (
        <ReviewsModal
          exerciseKey={reviewsModal}
          exerciseName={freeExercises[reviewsModal]?.name || ''}
          onClose={() => setReviewsModal(null)}
        />
      )}
    </div>
  );
}
