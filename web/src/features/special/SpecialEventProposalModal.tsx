import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { Barbadge } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import {
  getProposableWeeks,
  validateProposalInput,
  SPECIAL_EVENT_APPROVER_COUNT,
  SPECIAL_EVENT_EXERCISE_COUNT,
  type ApproverCandidate,
  type ProposableWeek,
} from '../../lib/special-event';
import {
  createSpecialEventProposal,
  loadPreviousWeekParticipants,
  loadProposalsByWeek,
} from '../../lib/special-event-engine';
import styles from './SpecialEvent.module.css';

/**
 * 特別イベントウィークの提案フォーム。
 * 4種目 / 開始日（次週からの月曜4週分）/ 承認者3人がすべて埋まると送信できる。
 */
export default function SpecialEventProposalModal({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const { user, userData, isGuest } = useAuth();
  const { freeExercises, usersMap } = useData();
  const { toast } = useToast();

  const weeks = useMemo(() => getProposableWeeks(), []);
  const [exercises, setExercises] = useState<string[]>([]);
  const [week, setWeek] = useState<ProposableWeek | null>(null);
  const [approverIds, setApproverIds] = useState<string[]>([]);

  const [candidates, setCandidates] = useState<ApproverCandidate[] | null>(null);
  const [weekUsage, setWeekUsage] = useState<
    Record<string, { pending: number; approved: number }>
  >({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // 週間チャレンジの対象になる種目だけを候補にする
  const pickable = useMemo(
    () =>
      Object.keys(freeExercises)
        .filter((k) => freeExercises[k] && !freeExercises[k].excludeFromWeekly)
        .sort((a, b) =>
          (freeExercises[a].name || a).localeCompare(freeExercises[b].name || b),
        ),
    [freeExercises],
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [list, usage] = await Promise.all([
          loadPreviousWeekParticipants(usersMap, user.uid),
          loadProposalsByWeek(),
        ]);
        if (cancelled) return;
        setCandidates(list);
        setWeekUsage(usage);
      } catch (e) {
        if (cancelled) return;
        console.error('[特別イベント] 承認者候補の取得に失敗:', e);
        setCandidates([]);
        setErr('承認者候補を読み込めませんでした');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, usersMap]);

  function toggleExercise(key: string) {
    setErr('');
    setExercises((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= SPECIAL_EVENT_EXERCISE_COUNT) return prev;
      return [...prev, key];
    });
  }

  function toggleApprover(uid: string) {
    setErr('');
    setApproverIds((prev) => {
      if (prev.includes(uid)) return prev.filter((x) => x !== uid);
      if (prev.length >= SPECIAL_EVENT_APPROVER_COUNT) return prev;
      return [...prev, uid];
    });
  }

  const validationError = validateProposalInput({
    exercises,
    weekStart: week?.weekStart || null,
    approverIds,
  });
  const canSubmit = !validationError && !busy && !isGuest;

  async function submit() {
    if (!user || !week) return;
    const invalid = validateProposalInput({
      exercises,
      weekStart: week.weekStart,
      approverIds,
    });
    if (invalid) {
      setErr(invalid);
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await createSpecialEventProposal({
        proposer: {
          uid: user.uid,
          name: userData?.userName || user.email || '名無しさん',
        },
        exercises,
        week,
        approvers: approverIds.map((uid) => ({
          userId: uid,
          userName:
            candidates?.find((c) => c.userId === uid)?.userName ||
            usersMap[uid]?.userName ||
            '名無しさん',
        })),
        freeExercises,
      });
      toast('特別イベントを提案しました。承認を待ちましょう', 'success');
      onSubmitted?.();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '送信に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="特別イベントを提案"
      icon="fa-wand-magic-sparkles"
      onClose={onClose}
    >
      <div className={styles.form}>
        <p className={styles.lead}>
          承認者{SPECIAL_EVENT_APPROVER_COUNT}人全員が承認すると、その週の週間チャレンジが
          この{SPECIAL_EVENT_EXERCISE_COUNT}種目に差し替わります。
        </p>

        {isGuest && (
          <p className={styles.warn}>
            <i className="fa-solid fa-triangle-exclamation" />{' '}
            ゲストアカウントからは提案できません
          </p>
        )}

        {/* --- 種目 --- */}
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>
            <i className="fa-solid fa-dumbbell" /> 種目
          </span>
          <span className={styles.counter}>
            {exercises.length}/{SPECIAL_EVENT_EXERCISE_COUNT}
          </span>
        </div>
        {pickable.length === 0 ? (
          <p className={styles.muted}>選べる種目がありません</p>
        ) : (
          <div className={styles.pickList}>
            {pickable.map((key) => {
              const ex = freeExercises[key];
              const on = exercises.includes(key);
              const order = exercises.indexOf(key) + 1;
              const full =
                !on && exercises.length >= SPECIAL_EVENT_EXERCISE_COUNT;
              return (
                <button
                  key={key}
                  type="button"
                  className={on ? styles.pickOn : styles.pick}
                  onClick={() => toggleExercise(key)}
                  disabled={full}
                  aria-pressed={on}
                >
                  <span className={styles.pickIcon}>
                    {on ? order : <i className={`fa-solid ${ex.icon}`} />}
                  </span>
                  <span className={styles.pickBody}>
                    <span className={styles.pickName}>
                      {ex.name}
                      {ex.barbarian && <Barbadge />}
                    </span>
                    {ex.rule && (
                      <span className={styles.pickRule}>{ex.rule}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* --- 開始日 --- */}
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>
            <i className="fa-solid fa-calendar-day" /> 開始日（月曜）
          </span>
        </div>
        <div className={styles.weekList}>
          {weeks.map((w) => {
            const usage = weekUsage[w.mondayKey];
            const on = week?.mondayKey === w.mondayKey;
            return (
              <button
                key={w.mondayKey}
                type="button"
                className={on ? styles.weekOn : styles.week}
                onClick={() => {
                  setErr('');
                  setWeek(w);
                }}
                aria-pressed={on}
              >
                <span className={styles.weekMain}>
                  <span className={styles.weekMonday}>{w.mondayKey} (月)</span>
                  <span className={styles.weekPeriod}>{w.periodLabel}</span>
                </span>
                {usage?.approved ? (
                  <span className={styles.tagApproved}>確定済みあり</span>
                ) : usage?.pending ? (
                  <span className={styles.tagPending}>申請中あり</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* --- 承認者 --- */}
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>
            <i className="fa-solid fa-user-check" /> 承認者
          </span>
          <span className={styles.counter}>
            {approverIds.length}/{SPECIAL_EVENT_APPROVER_COUNT}
          </span>
        </div>
        <p className={styles.muted}>前週の週間チャレンジに投稿した人から選べます</p>
        {candidates === null ? (
          <p className={styles.muted}>読み込み中...</p>
        ) : candidates.length < SPECIAL_EVENT_APPROVER_COUNT ? (
          <p className={styles.warn}>
            <i className="fa-solid fa-triangle-exclamation" /> 前週の投稿者が
            {SPECIAL_EVENT_APPROVER_COUNT}人に届いていないため、いまは提案できません
            （現在{candidates.length}人）
          </p>
        ) : (
          <div className={styles.chips}>
            {candidates.map((c) => {
              const on = approverIds.includes(c.userId);
              const full =
                !on && approverIds.length >= SPECIAL_EVENT_APPROVER_COUNT;
              return (
                <button
                  key={c.userId}
                  type="button"
                  className={on ? styles.chipOn : styles.chip}
                  onClick={() => toggleApprover(c.userId)}
                  disabled={full}
                  aria-pressed={on}
                >
                  {on && <i className="fa-solid fa-check" />} {c.userName}
                  <span className={styles.chipCount}>{c.postCount}投稿</span>
                </button>
              );
            })}
          </div>
        )}

        {err && <p className={styles.err}>{err}</p>}

        <button className="btn-primary" disabled={!canSubmit} onClick={submit}>
          {busy ? (
            <i className="fa-solid fa-circle-notch spin" />
          ) : (
            <>
              <i className="fa-solid fa-paper-plane" /> 送信する
            </>
          )}
        </button>
        {!busy && validationError && !isGuest && (
          <p className={styles.hint}>{validationError}</p>
        )}
      </div>
    </Modal>
  );
}
