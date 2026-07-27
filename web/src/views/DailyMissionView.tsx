import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { submitPost } from '../lib/posts';
import {
  formatDailyDateLabel,
  guessExerciseUnit,
} from '../lib/daily-mission';
import DistributionChart from '../features/daily/DistributionChart';
import { EmptyState, Skeleton, ViewHeader } from '../components/ui';
import styles from './DailyMissionView.module.css';

export default function DailyMissionView() {
  const { user } = useAuth();
  const { freeExercises, dailyMission, dailyLoading, reloadDailyMission } =
    useData();
  const { toast } = useToast();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  if (dailyLoading) {
    return (
      <div className="fade-in">
        <ViewHeader icon="fa-bullseye" title="デイリーミッション" />
        <Skeleton count={2} />
      </div>
    );
  }

  if (!dailyMission) {
    return (
      <div className="fade-in">
        <ViewHeader icon="fa-bullseye" title="デイリーミッション" />
        <EmptyState
          icon="fa-dumbbell"
          message="対象になる種目がまだありません。「種目」タブから追加できます"
        />
      </div>
    );
  }

  const { exerciseKey, target, cleared, totalValue, dateKey } = dailyMission;
  const ex = freeExercises[exerciseKey];
  const unit = guessExerciseUnit(ex?.name || '');
  const percent = Math.min(100, Math.round((totalValue / target) * 100));
  const remaining = Math.max(0, target - totalValue);
  const clearedCount = dailyMission.participants.filter((p) => p.cleared).length;

  async function handleSubmit() {
    if (!user) return;
    const num = parseInt(value, 10);
    if (!num || num <= 0 || isNaN(num) || num > 10000) {
      toast(`${unit}数を正しく入力してください（1〜10000）`, 'error');
      return;
    }
    setBusy(true);
    try {
      await submitPost(user, exerciseKey, num);
      setValue('');
      // 合計での達成判定。投稿ぶんだけ確実に増えるので手元で足して判定できる
      const nextTotal = totalValue + num;
      const nowCleared = nextTotal >= target;
      toast(
        nowCleared && !cleared
          ? 'ミッション達成！おつかれさま 🎉'
          : nowCleared
            ? `記録しました（合計 ${nextTotal}${unit}）`
            : `記録しました（合計 ${nextTotal}${unit} / あと ${target - nextTotal}${unit}）`,
        nowCleared ? 'success' : 'info',
      );
      await reloadDailyMission();
    } catch {
      toast('投稿に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-in">
      <ViewHeader
        icon="fa-bullseye"
        title="デイリーミッション"
        action={<span className={styles.date}>{formatDailyDateLabel(dateKey)}</span>}
      />

      <p className={styles.lead}>
        全員が同じ種目に挑戦。目標回数は一人ひとり違います。
        その日の投稿を合計して達成を判定するので、何回かに分けてもOK。
      </p>

      <div className={`${styles.card} ${cleared ? styles.cardDone : ''}`}>
        <div className={styles.badge}>
          {cleared ? (
            <>
              <i className="fa-solid fa-circle-check" /> クリア済み
            </>
          ) : (
            <>
              <i className="fa-solid fa-fire" /> 挑戦中
            </>
          )}
        </div>

        <div className={styles.exRow}>
          <span className={styles.exIcon}>
            <i className={`fa-solid ${ex?.icon || 'fa-dumbbell'}`} />
          </span>
          <span className={styles.exName}>{ex?.name || exerciseKey}</span>
        </div>

        <div className={styles.targetBox}>
          <span className={styles.targetLabel}>あなたの目標</span>
          <span className={styles.targetValue}>
            {target}
            <span className={styles.targetUnit}>{unit}</span>
          </span>
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.progressBar}>
            <div
              className={cleared ? styles.progressFillDone : styles.progressFill}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className={styles.progressText}>
            <span>
              今日の合計 {totalValue}
              {unit}
            </span>
            <span>
              {cleared ? '達成！' : `あと ${remaining}${unit}`}
            </span>
          </div>
        </div>

        {ex?.rule && <p className={styles.rule}>{ex.rule}</p>}
      </div>

      {dailyMission.participants.length > 0 && (
        <div className={styles.distCard}>
          <div className={styles.distHead}>
            <span>
              <i className="fa-solid fa-chart-simple" /> みんなの目標
            </span>
            <span className={styles.distCount}>
              {clearedCount}/{dailyMission.participants.length} 人クリア
            </span>
          </div>
          <DistributionChart
            participants={dailyMission.participants}
            unit={unit}
          />
          <p className={styles.distNote}>
            全員が同じ種目。目標回数は 30{unit} をピークにした偏った分布から
            一人ひとり抽選されます。
          </p>
        </div>
      )}

      <div className={styles.postCard}>
        <h3 className={styles.postTitle}>
          <i className="fa-solid fa-pen-to-square" /> 記録を投稿
        </h3>
        <div className={styles.inputRow}>
          <input
            className="field"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            placeholder={`${unit}数`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <span className={styles.unit}>{unit}</span>
          <button className="btn-primary" disabled={busy} onClick={handleSubmit}>
            {busy ? <i className="fa-solid fa-circle-notch spin" /> : '投稿'}
          </button>
        </div>
        <p className={styles.note}>
          この投稿はフリーモードの記録としても集計されます。
        </p>
      </div>
    </div>
  );
}
