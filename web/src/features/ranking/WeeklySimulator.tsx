import { useEffect, useState } from 'react';
import { clampSimValue } from '../../lib/weekly-simulator';
import styles from './WeeklySimulator.module.css';

/** シミュレーターの ON/OFF と、書き換え中の件数・リセット */
export function SimulatorControl({
  enabled,
  onToggle,
  overrideCount,
  onReset,
}: {
  enabled: boolean;
  onToggle: (on: boolean) => void;
  overrideCount: number;
  onReset: () => void;
}) {
  return (
    <div className={`${styles.card} ${enabled ? styles.cardOn : ''}`}>
      <div className={styles.head}>
        <span className={styles.title}>
          <i className="fa-solid fa-flask" /> シミュレーター
        </span>
        <label className={styles.switch}>
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            aria-label="シミュレーター"
          />
          <span className={styles.slider} />
        </label>
      </div>
      <p className={styles.note}>
        {enabled
          ? '各プレイヤーを開いて記録を書き換えると、総合得点と順位が計算し直されます（保存されません）。'
          : 'ONにすると、記録を仮に変えたときの総合得点と順位の変化を確認できます。'}
      </p>
      {enabled && overrideCount > 0 && (
        <div className={styles.status}>
          <span>
            <i className="fa-solid fa-pen" /> {overrideCount}件を書き換え中
          </span>
          <button className={styles.reset} onClick={onReset}>
            <i className="fa-solid fa-rotate-left" /> 元に戻す
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 記録値の入力欄。入力中は順位を動かさず、確定（フォーカスを外す / Enter）
 * した時点で反映する（打っている最中に行が並び替わって指が迷子にならないように）。
 */
export function SimValueInput({
  value,
  baseValue,
  unit,
  label,
  onCommit,
}: {
  value: number;
  baseValue: number;
  unit: string;
  label: string;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const edited = value !== baseValue;

  function commit() {
    const v = clampSimValue(draft, value);
    setDraft(String(v));
    if (v !== value) onCommit(v);
  }

  return (
    <span className={styles.inputWrap}>
      <span className={styles.inputRow}>
        <input
          className={`${styles.input} ${edited ? styles.inputEdited : ''}`}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={draft}
          aria-label={`${label}の記録`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onFocus={(e) => e.currentTarget.select()}
        />
        <span className={styles.unit}>{unit}</span>
      </span>
      {edited && (
        <button
          className={styles.base}
          onClick={() => onCommit(baseValue)}
          title="実際の記録に戻す"
        >
          実際 {baseValue}
          {unit}
        </button>
      )}
    </span>
  );
}

/** 実際の順位からの変動（▲2 / ▼1） */
export function RankShift({ delta }: { delta: number }) {
  if (!delta) return null;
  return (
    <span className={delta > 0 ? styles.up : styles.down}>
      {delta > 0 ? `▲${delta}` : `▼${-delta}`}
    </span>
  );
}
