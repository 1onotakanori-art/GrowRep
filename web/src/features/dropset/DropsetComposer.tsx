import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDropset } from '../../context/DropsetContext';
import { useMode } from '../../context/ModeContext';
import { useToast } from '../../context/ToastContext';
import { submitDropsetAttempt } from '../../lib/dropset-engine';
import {
  TARGET_REPS,
  formatWeight,
  isCleared,
  progressOf,
  shortfallOf,
  validateAttempt,
} from '../../lib/dropset';
import { EmptyState, ExerciseIcon, Skeleton } from '../../components/ui';
import styles from './DropsetComposer.module.css';

/** 空文字は 0 扱い（未入力のセットは「0回」として判定する） */
function toInt(v: string): number {
  if (v.trim() === '') return 0;
  return Number(v);
}

export default function DropsetComposer() {
  const { user } = useAuth();
  const { refresh } = useMode();
  const { exercises, attempts, loading, reload } = useDropset();
  const { toast } = useToast();

  const [selected, setSelected] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState<string[]>(TARGET_REPS.map(() => ''));
  const [busy, setBusy] = useState(false);

  const list = useMemo(
    () =>
      Object.entries(exercises).sort(([, a], [, b]) =>
        a.name.localeCompare(b.name, 'ja'),
      ),
    [exercises],
  );

  function open(key: string) {
    const ex = exercises[key];
    const p = user ? progressOf(attempts, user.uid, key, ex) : null;
    setSelected(key);
    setWeight(p ? formatWeight(p.suggestedWeight) : '');
    setReps(TARGET_REPS.map(() => ''));
  }

  function close() {
    setSelected(null);
    setReps(TARGET_REPS.map(() => ''));
  }

  async function handleSubmit(key: string) {
    if (!user) return;
    const w = Number(weight);
    const r = reps.map(toInt);
    const err = validateAttempt(w, r);
    if (err) {
      toast(err, 'error');
      return;
    }
    setBusy(true);
    try {
      const cleared = await submitDropsetAttempt(user, key, w, r);
      const step = exercises[key]?.step ?? 0;
      if (cleared) {
        toast(
          `${formatWeight(w)}kg クリア！次は ${formatWeight(w + step)}kg`,
          'success',
        );
      } else {
        const short = shortfallOf(r).reduce((s, v) => s + v, 0);
        toast(
          `あと${short}回。次も ${formatWeight(w)}kg に挑戦！`,
          'success',
        );
      }
      close();
      await reload();
      // フィードにも流れるので、他タブのキャッシュも更新させる
      refresh();
    } catch {
      toast('記録に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton count={3} />;

  if (list.length === 0) {
    return (
      <EmptyState
        icon="fa-weight-hanging"
        message="種目がまだありません。「種目」タブから追加できます"
      />
    );
  }

  return (
    <div className={styles.grid}>
      {list.map(([key, ex]) => {
        const p = user ? progressOf(attempts, user.uid, key, ex) : null;
        const open_ = selected === key;
        const typed = reps.map(toInt);
        const willClear = isCleared(typed);
        const anyTyped = reps.some((v) => v.trim() !== '');
        return (
          <div
            key={key}
            className={`${styles.card} ${open_ ? styles.cardOpen : ''}`}
          >
            <button
              className={styles.cardHead}
              onClick={() => (open_ ? close() : open(key))}
            >
              <span className={styles.icon}>
                <ExerciseIcon icon={ex.icon} />
              </span>
              <span className={styles.headMain}>
                <span className={styles.name}>{ex.name}</span>
                <span className={styles.sub}>
                  {p?.clearedMax == null
                    ? 'まだクリアなし'
                    : `クリア済み ${formatWeight(p.clearedMax)}kg`}
                  {p && p.stalledCount > 0 && (
                    <span className={styles.stall}>
                      {' '}
                      · {p.stalledCount}回停滞中
                    </span>
                  )}
                </span>
              </span>
              <span className={styles.nextBadge}>
                {p ? `${formatWeight(p.suggestedWeight)}kg` : '—'}
              </span>
              <i
                className={`fa-solid fa-chevron-${open_ ? 'up' : 'down'} ${styles.chev}`}
              />
            </button>

            {ex.rule && !open_ && <p className={styles.rule}>{ex.rule}</p>}

            {open_ && (
              <div className={styles.form}>
                {ex.rule && <p className={styles.ruleOpen}>{ex.rule}</p>}

                <label className={styles.fieldLabel}>重量</label>
                <div className={styles.weightRow}>
                  <button
                    className={styles.stepBtn}
                    type="button"
                    aria-label={`${formatWeight(ex.step)}kg 減らす`}
                    onClick={() =>
                      setWeight((w) =>
                        formatWeight(Math.max(0, Number(w) - ex.step)),
                      )
                    }
                  >
                    <i className="fa-solid fa-minus" />
                  </button>
                  <input
                    className="field"
                    type="number"
                    inputMode="decimal"
                    step={ex.step}
                    min={0}
                    value={weight}
                    autoFocus
                    onChange={(e) => setWeight(e.target.value)}
                  />
                  <span className={styles.unit}>kg</span>
                  <button
                    className={styles.stepBtn}
                    type="button"
                    aria-label={`${formatWeight(ex.step)}kg 増やす`}
                    onClick={() =>
                      setWeight((w) => formatWeight(Number(w) + ex.step))
                    }
                  >
                    <i className="fa-solid fa-plus" />
                  </button>
                </div>

                <label className={styles.fieldLabel}>
                  できた回数（目標 {TARGET_REPS.join(' - ')}）
                </label>
                <div className={styles.setsRow}>
                  {TARGET_REPS.map((t, i) => {
                    const ok = typed[i] >= t;
                    return (
                      <div key={i} className={styles.setField}>
                        <span className={styles.setLabel}>{i + 1}セット目</span>
                        <div className={styles.setInputWrap}>
                          <input
                            className={`field ${
                              !reps[i].trim()
                                ? ''
                                : ok
                                  ? styles.repOk
                                  : styles.repNg
                            }`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            placeholder={String(t)}
                            value={reps[i]}
                            onChange={(e) =>
                              setReps((prev) =>
                                prev.map((v, j) =>
                                  j === i ? e.target.value : v,
                                ),
                              )
                            }
                            onKeyDown={(e) =>
                              e.key === 'Enter' && handleSubmit(key)
                            }
                          />
                        </div>
                        <span className={styles.setTarget}>目標 {t}</span>
                      </div>
                    );
                  })}
                </div>

                {anyTyped && (
                  <p
                    className={willClear ? styles.previewOk : styles.previewNg}
                  >
                    {willClear ? (
                      <>
                        <i className="fa-solid fa-circle-check" />{' '}
                        {formatWeight(Number(weight) || 0)}kg クリア！ 次は{' '}
                        {formatWeight((Number(weight) || 0) + ex.step)}kg
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-circle-minus" /> あと
                        {shortfallOf(typed).reduce((s, v) => s + v, 0)}
                        回。記録は残ります
                      </>
                    )}
                  </p>
                )}

                <button
                  className="btn-primary"
                  disabled={busy}
                  onClick={() => handleSubmit(key)}
                >
                  {busy ? (
                    <i className="fa-solid fa-circle-notch spin" />
                  ) : (
                    '記録する'
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
