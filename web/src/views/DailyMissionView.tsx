import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { submitPost } from '../lib/posts';
import {
  buildDailyTeamProgress,
  dailyContributionRatio,
  formatDailyCount,
  formatDailyDateLabel,
  formatDailyProbability,
  getDailyBoundariesJST,
  guessExerciseUnit,
} from '../lib/daily-mission';
import {
  RAID_END_DATE_KEY,
  RAID_INPUT_GATE_NOTE,
  RAID_MODE_LABEL,
  RAID_START_DATE_KEY,
  RAID_TITLE,
  RAID_TOTAL_DAYS,
  getRaidInputOpenAt,
  isRaidInputGatedDay,
  isRaidInputOpen,
  raidContributionRatio,
} from '../lib/raid-mode';
import DistributionChart from '../features/daily/DistributionChart';
import { EmptyState, Skeleton, ViewHeader } from '../components/ui';
import styles from './DailyMissionView.module.css';

/** 残り時間を「X時間YY分ZZ秒」で刻む。target が null なら止める。 */
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

export default function DailyMissionView() {
  const { user } = useAuth();
  const { freeExercises, dailyMission, dailyLoading, reloadDailyMission } =
    useData();
  const { toast } = useToast();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  // 早期 return より前に置く（フックの呼び出し順を固定するため）
  const participants = dailyMission?.participants;
  const team = useMemo(
    () =>
      participants && participants.length > 0
        ? buildDailyTeamProgress(participants)
        : null,
    [participants],
  );
  const raidStartMs = useMemo(
    () => getDailyBoundariesJST(RAID_START_DATE_KEY).start.getTime(),
    [],
  );
  const countdown = useCountdown(dailyMission?.maintenance ? raidStartMs : null);

  // レイドは 0:00 に種目発表、入力開始は 7:00。解禁までは投稿フォームを出さない。
  const raidDateKey = dailyMission?.raid ? dailyMission.dateKey : null;
  const inputOpen = raidDateKey ? isRaidInputOpen(raidDateKey) : true;
  const openAtMs = useMemo(
    () => (raidDateKey ? getRaidInputOpenAt(raidDateKey).getTime() : null),
    [raidDateKey],
  );
  const openCountdown = useCountdown(inputOpen ? null : openAtMs);
  // 7:00 を過ぎたらフォームに差し替える（リロード不要）
  useEffect(() => {
    if (inputOpen || openAtMs == null) return;
    const wait = Math.max(0, openAtMs - Date.now()) + 500;
    const id = window.setTimeout(() => reloadDailyMission(), wait);
    return () => window.clearTimeout(id);
  }, [inputOpen, openAtMs, reloadDailyMission]);

  const exerciseKey = dailyMission?.exerciseKey || '';
  const ex = freeExercises[exerciseKey];
  const unit = guessExerciseUnit(ex?.name || '');
  const raid = dailyMission?.raid || null;

  /** 記録を投稿して状態を取り直す。通知の文面だけレイドと通常で変える。 */
  async function handleSubmit() {
    if (!user || !dailyMission || !exerciseKey) return;
    // 画面を開いたまま日付をまたいだ場合などに備え、送信時にも解禁を確認する
    if (raidDateKey && !isRaidInputOpen(raidDateKey)) {
      toast('レイドの入力は7:00からです', 'error');
      await reloadDailyMission();
      return;
    }
    const num = parseInt(value, 10);
    if (!num || num <= 0 || isNaN(num) || num > 10000) {
      toast(`${unit}数を正しく入力してください（1〜10000）`, 'error');
      return;
    }
    setBusy(true);
    try {
      await submitPost(user, exerciseKey, num);
      setValue('');
      if (raid) {
        // 投稿ぶんは確実に増えるので、みんなの合計に足して手元で判定できる
        const nextTotal = raid.totalValue + num;
        toast(
          nextTotal >= raid.goal && !raid.cleared
            ? 'レイド討伐完了！ おつかれさま 🎉'
            : nextTotal >= raid.goal
              ? `記録しました（みんなの合計 ${formatDailyCount(nextTotal)}${unit}）`
              : `記録しました（みんなであと ${formatDailyCount(raid.goal - nextTotal)}${unit}）`,
          nextTotal >= raid.goal ? 'success' : 'info',
        );
      } else {
        const { totalValue, target, cleared } = dailyMission;
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
      }
      await reloadDailyMission();
    } catch {
      toast('投稿に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  }

  /** 入力解禁前のロック表示（7:00までのカウントダウンと、そうしている理由）。 */
  function renderLockedPostCard() {
    return (
      <div className={styles.postCard}>
        <h3 className={styles.postTitle}>
          <i className="fa-solid fa-lock" /> 入力開始まで
        </h3>
        <div className={styles.maintCountdownBox}>
          <span className={styles.maintCountdownLabel}>
            <i className="fa-solid fa-clock" /> 7:00 まで
          </span>
          <span className={styles.maintCountdown}>
            {openCountdown || 'まもなく'}
          </span>
        </div>
        <p className={styles.note}>{RAID_INPUT_GATE_NOTE}</p>
      </div>
    );
  }

  /** 記録の投稿フォーム（通常・レイド共通）。 */
  function renderPostCard(note: string) {
    return (
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
        <p className={styles.note}>{note}</p>
      </div>
    );
  }

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

  // ---------------------------------------------------------------
  // レイド開始前のメンテナンス表示
  // ---------------------------------------------------------------
  if (dailyMission.maintenance) {
    return (
      <div className="fade-in">
        <ViewHeader
          icon="fa-bullseye"
          title="デイリーミッション"
          action={
            <span className={styles.date}>
              {formatDailyDateLabel(dailyMission.dateKey)}
            </span>
          }
        />
        <div className={`${styles.card} ${styles.maintCard}`}>
          <div className={`${styles.badge} ${styles.maintBadge}`}>
            <i className="fa-solid fa-screwdriver-wrench" /> メンテナンス中
          </div>
          <p className={styles.maintLead}>
            本日のデイリーミッションはお休みです。
            <br />
            明日 0:00 から{RAID_MODE_LABEL}がはじまります。
          </p>
          <div className={styles.maintCountdownBox}>
            <span className={styles.maintCountdownLabel}>
              <i className="fa-solid fa-dragon" /> {RAID_TITLE} まで
            </span>
            <span className={styles.maintCountdown}>
              {countdown || 'まもなく'}
            </span>
          </div>
          <ul className={styles.maintList}>
            <li>
              <i className="fa-solid fa-people-group" />
              毎日ひとつの種目をピックアップ。
              <strong>その日にやった全員ぶんの回数を合計</strong>
              して目標に挑みます。
            </li>
            <li>
              <i className="fa-solid fa-dumbbell" />
              1日目は<strong>全員で腕立て1,000回</strong>。
            </li>
            <li>
              <i className="fa-solid fa-calendar-week" />
              来週は夏休みのため、週間チャレンジは1週間お休み（種目の選出なし）。
            </li>
          </ul>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // レイド開催中
  // ---------------------------------------------------------------
  if (raid) {
    const maxValue = raid.contributors[0]?.value || 0;
    return (
      <div className="fade-in">
        <ViewHeader
          icon="fa-dragon"
          title={RAID_TITLE}
          action={
            <span className={styles.date}>
              {formatDailyDateLabel(dailyMission.dateKey)}
            </span>
          }
        />

        <p className={styles.lead}>
          {RAID_MODE_LABEL}（{RAID_START_DATE_KEY.slice(5).replace('-', '/')}〜
          {RAID_END_DATE_KEY.slice(5).replace('-', '/')}）。
          今日の種目を全員で積み上げて、レイドボスの体力を削り切ります。
          個人の目標回数はありません。
        </p>

        <div className={`${styles.card} ${raid.cleared ? styles.cardDone : ''}`}>
          <div className={`${styles.badge} ${styles.raidBadge}`}>
            <i className={`fa-solid ${raid.cleared ? 'fa-circle-check' : 'fa-dragon'}`} />
            {raid.cleared ? '討伐完了' : `Day ${raid.day} / ${RAID_TOTAL_DAYS}`}
          </div>

          <div className={styles.exRow}>
            <span className={styles.exIcon}>
              <i className={`fa-solid ${ex?.icon || 'fa-dumbbell'}`} />
            </span>
            <span className={styles.exName}>{ex?.name || exerciseKey}</span>
          </div>

          <div className={styles.raidGoalBox}>
            <span className={styles.targetLabel}>
              <i className="fa-solid fa-dragon" /> レイドボスの体力
            </span>
            <span className={styles.targetValue}>
              {formatDailyCount(raid.goal)}
              <span className={styles.targetUnit}>{unit}</span>
            </span>
            {raid.perPerson != null && (
              <span className={styles.targetProb}>
                昨日ログインした {raid.memberCount}人 × 1人{raid.perPerson}
                {unit}
              </span>
            )}
            <span className={styles.targetProb}>{raid.label}</span>
          </div>

          {raid.perPerson != null && (
            <p className={styles.raidGoalNote}>
              <i className="fa-solid fa-users" />
              ボスの体力は<strong>前日のログイン人数</strong>で決まります。
              0:00の時点で決まるので、今日どれだけ人が増えても体力は動きません。
            </p>
          )}

          <div className={styles.teamTotalRow}>
            <span className={styles.teamTotal}>
              {formatDailyCount(raid.totalValue)}
            </span>
            <span className={styles.teamGoal}>
              / {formatDailyCount(raid.goal)}
              {unit}
            </span>
          </div>

          <div className={styles.progressWrap}>
            <div className={styles.progressBar}>
              <div
                className={raid.cleared ? styles.progressFillDone : styles.progressFill}
                style={{ width: `${raid.percent}%` }}
              />
            </div>
            <div className={styles.progressText}>
              <span>{raid.percent}%</span>
              <span>
                {raid.cleared
                  ? '討伐完了！'
                  : `残り体力 ${formatDailyCount(raid.remaining)}${unit}`}
              </span>
            </div>
          </div>

          {ex?.rule && <p className={styles.rule}>{ex.rule}</p>}
        </div>

        <div className={styles.distCard}>
          <div className={styles.distHead}>
            <span>
              <i className="fa-solid fa-people-group" /> みんなの貢献
            </span>
            <span className={styles.distCount}>
              {raid.activeCount}/{raid.contributors.length} 人が参加
            </span>
          </div>

          <ul className={styles.contribList}>
            {raid.contributors.map((c) => (
              <li
                key={c.userId}
                className={`${styles.contribRow} ${c.isMe ? styles.contribMe : ''}`}
              >
                <span className={styles.contribName}>{c.userName}</span>
                <span className={styles.contribBarWrap}>
                  <span
                    className={styles.contribBar}
                    style={{
                      width: `${raidContributionRatio(c.value, maxValue) * 100}%`,
                    }}
                  />
                </span>
                <span className={styles.contribValue}>
                  {formatDailyCount(c.value)}
                  <span className={styles.contribTarget}>
                    {' '}
                    {Math.round(c.share * 100)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className={styles.distNote}>
            並ぶのは今日ログインした人だけ。右の％はみんなの合計に占める割合です。
            あなたの今日の合計は {formatDailyCount(raid.myValue)}
            {unit}。
          </p>
        </div>

        {inputOpen
          ? renderPostCard(
              '何回かに分けてもOK。投稿するとすぐレイドの合計に加算されます（フリーモードの記録としても集計されます）。'
                + (isRaidInputGatedDay(dailyMission.dateKey)
                  ? ` ${RAID_INPUT_GATE_NOTE}`
                  : ''),
            )
          : renderLockedPostCard()}
      </div>
    );
  }

  // ---------------------------------------------------------------
  // 通常のデイリーミッション
  // ---------------------------------------------------------------
  const {
    target,
    cleared,
    totalValue,
    dateKey,
    peak,
    bestValue,
    peakSource,
    probability,
  } = dailyMission;
  const percent = Math.min(100, Math.round((totalValue / target) * 100));
  const remaining = Math.max(0, target - totalValue);
  const clearedCount = dailyMission.participants.filter((p) => p.cleared).length;

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
          <span className={styles.targetProb}>
            この数字を引く確率 {formatDailyProbability(probability)}
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

      {team && (
        <div
          className={`${styles.distCard} ${team.cleared ? styles.teamDone : ''}`}
        >
          <div className={styles.distHead}>
            <span>
              <i className="fa-solid fa-people-group" /> みんなの合計
            </span>
            <span className={styles.distCount}>
              {team.activeCount}/{team.contributors.length} 人が投稿
            </span>
          </div>

          <div className={styles.teamTotalRow}>
            <span className={styles.teamTotal}>
              {formatDailyCount(team.totalValue)}
            </span>
            <span className={styles.teamGoal}>
              / {formatDailyCount(team.goal)}
              {unit}
            </span>
          </div>

          <div className={styles.progressWrap}>
            <div className={styles.progressBar}>
              <div
                className={
                  team.cleared ? styles.progressFillDone : styles.progressFill
                }
                style={{ width: `${team.percent}%` }}
              />
            </div>
            <div className={styles.progressText}>
              <span>{team.percent}%</span>
              <span>
                {team.cleared
                  ? 'みんなの目標を達成！'
                  : `あと ${formatDailyCount(team.remaining)}${unit}`}
              </span>
            </div>
          </div>

          <ul className={styles.contribList}>
            {team.contributors.map((c) => (
              <li
                key={c.userId}
                className={`${styles.contribRow} ${c.isMe ? styles.contribMe : ''}`}
              >
                <span className={styles.contribName}>
                  {c.cleared && (
                    <i className={`fa-solid fa-circle-check ${styles.contribCheck}`} />
                  )}
                  {c.userName}
                </span>
                <span className={styles.contribBarWrap}>
                  <span
                    className={c.cleared ? styles.contribBarDone : styles.contribBar}
                    style={{
                      width: `${
                        dailyContributionRatio(
                          c.value,
                          team.contributors[0]?.value || 0,
                        ) * 100
                      }%`,
                    }}
                  />
                </span>
                <span className={styles.contribValue}>
                  {formatDailyCount(c.value)}
                  <span className={styles.contribTarget}>/{c.target}</span>
                </span>
              </li>
            ))}
          </ul>

          <p className={styles.distNote}>
            今日ログインした人ぜんぶの合計。目標はみんなの目標を足した数字です。
          </p>
        </div>
      )}

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
            peak={peak}
          />
          <p className={styles.distNote}>
            並ぶのは今日ログインした人だけ。名前の横の％は、その回数を引く確率です。
            目標は {peak}
            {unit} をピークに、大きい側を狭めた分布から一人ひとり抽選されます
            {peakSource === 'best'
              ? `（ピークはこの種目の過去最高 ${bestValue}${unit}）`
              : '（この種目はまだ投稿が無いので 30 がピーク）'}
            。
          </p>
        </div>
      )}

      {renderPostCard('この投稿はフリーモードの記録としても集計されます。')}
    </div>
  );
}
