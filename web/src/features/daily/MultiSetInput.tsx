import { useEffect, useRef, useState } from 'react';
import {
  MULTI_SET_MAX,
  MULTI_SET_VALUE_MAX,
  collectSetValues,
  sumSetValues,
  type SetSplit,
} from '../../lib/multi-set';
import { formatDailyCount } from '../../lib/daily-mission';
import styles from './MultiSetInput.module.css';

interface Props {
  unit: string;
  /** 分け方の候補。空なら候補の行は出さない */
  splits: SetSplit[];
  /** 投稿前の時点での合計（個人の今日の合計、またはレイドのみんなの合計） */
  baseTotal: number;
  /** 見通しのバーの基準。null ならバーを出さない */
  goal: number | null;
  /** バー横の表記（「目標」「ボスの体力」など） */
  goalLabel: string;
  busy: boolean;
  note: string;
  /** 投稿する回数（セット順）。true を返したら入力を空に戻す */
  onSubmit: (values: number[]) => Promise<boolean>;
}

/**
 * デイリーの記録入力。分け方の候補をタップするとセットのチップに展開し、
 * チップは1つずつ直接書き換えられる。投稿はセットごとに1件ずつ。
 */
export default function MultiSetInput({
  unit,
  splits,
  baseTotal,
  goal,
  goalLabel,
  busy,
  note,
  onSubmit,
}: Props) {
  const [raw, setRaw] = useState<string[]>(['']);
  const [activeSplit, setActiveSplit] = useState<string | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // 「＋」で増やしたチップにそのまま入力できるようにする
  useEffect(() => {
    if (focusIdx == null) return;
    const el = inputs.current[focusIdx];
    el?.focus();
    el?.select();
    setFocusIdx(null);
  }, [focusIdx]);

  const { values, error } = collectSetValues(raw);
  const sum = sumSetValues(values);
  const after = baseTotal + sum;

  function edit(i: number, v: string) {
    setRaw((prev) => prev.map((s, j) => (j === i ? v : s)));
    setActiveSplit(null);
  }

  function remove(i: number) {
    setRaw((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : ['']));
    setActiveSplit(null);
  }

  function add() {
    if (raw.length >= MULTI_SET_MAX) return;
    // 直前のセットと同じ回数で増やす（同じ回数で続けることが多いため）
    const last = raw[raw.length - 1]?.trim() || '';
    setRaw((prev) => [...prev, last]);
    setActiveSplit(null);
    setFocusIdx(raw.length);
  }

  function applySplit(s: SetSplit) {
    setRaw(s.values.map(String));
    setActiveSplit(s.id);
  }

  async function submit() {
    if (busy || error) return;
    const ok = await onSubmit(values);
    if (ok) {
      setRaw(['']);
      setActiveSplit(null);
    }
  }

  const pct = (n: number) => (goal && goal > 0 ? Math.min(100, (n / goal) * 100) : 0);
  const doneW = pct(baseTotal);
  const pendW = Math.max(0, pct(after) - doneW);
  const alreadyCleared = goal != null && baseTotal >= goal;
  const willClear = goal != null && !alreadyCleared && after >= goal && sum > 0;

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>
        <i className="fa-solid fa-pen-to-square" /> 記録を投稿
      </h3>

      {splits.length > 0 && (
        <div className={styles.block}>
          <div className={styles.label}>
            <span>分け方の候補</span>
            <span>タップで下に展開</span>
          </div>
          <div className={styles.splits}>
            {splits.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`${styles.split} ${activeSplit === s.id ? styles.splitOn : ''}`}
                onClick={() => applySplit(s)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.block}>
        <div className={styles.label}>
          <span>やったセット</span>
          <span>
            合計 {formatDailyCount(sum)}
            {unit}
          </span>
        </div>
        <div className={styles.chips}>
          {raw.map((v, i) => (
            <div key={i} className={styles.chip}>
              <span className={styles.chipIdx}>{i + 1}セット</span>
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                className={styles.chipInput}
                type="number"
                inputMode="numeric"
                min={0}
                max={MULTI_SET_VALUE_MAX}
                placeholder="0"
                aria-label={`${i + 1}セット目の${unit}数`}
                value={v}
                onChange={(e) => edit(i, e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
              {(raw.length > 1 || v !== '') && (
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label={`${i + 1}セット目を削除`}
                  onClick={() => remove(i)}
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>
          ))}
          {raw.length < MULTI_SET_MAX && (
            <button
              type="button"
              className={`${styles.chip} ${styles.chipAdd}`}
              aria-label="セットを追加"
              onClick={add}
            >
              <i className="fa-solid fa-plus" />
            </button>
          )}
        </div>
      </div>

      {goal != null && (
        <div className={styles.forecast}>
          <div className={`${styles.bar} ${after >= goal ? styles.barFull : ''}`}>
            <div className={styles.barDone} style={{ width: `${doneW}%` }} />
            <div
              className={styles.barPend}
              style={{ left: `${doneW}%`, width: `${pendW}%` }}
            />
          </div>
          <div className={styles.forecastText}>
            <span>
              投稿後 {formatDailyCount(after)} / {formatDailyCount(goal)}
              {unit}
            </span>
            {willClear ? (
              <span className={styles.ok}>
                <i className="fa-solid fa-circle-check" /> 投稿で達成！
              </span>
            ) : alreadyCleared ? (
              <span className={styles.ok}>達成済み</span>
            ) : (
              <span>
                {goalLabel}まであと {formatDailyCount(goal - after)}
                {unit}
              </span>
            )}
          </div>
        </div>
      )}

      {error === 'invalid' && (
        <p className={styles.error}>
          {unit}数は1〜{formatDailyCount(MULTI_SET_VALUE_MAX)}の整数で入力してください
        </p>
      )}

      <button
        className="btn-primary"
        disabled={busy || error != null}
        onClick={submit}
      >
        {busy ? (
          <i className="fa-solid fa-circle-notch spin" />
        ) : error ? (
          '投稿'
        ) : values.length > 1 ? (
          `${values.length}セット・${formatDailyCount(sum)}${unit}を投稿`
        ) : (
          `${formatDailyCount(sum)}${unit}を投稿`
        )}
      </button>
      <p className={styles.note}>{note}</p>
    </div>
  );
}
