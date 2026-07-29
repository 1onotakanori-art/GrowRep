import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  BEATS_PER_BAR,
  BPM_MAX,
  BPM_MIN,
  DEFAULT_BPM,
  INTERVAL_MAX,
  INTERVAL_MIN,
  IntervalTimerEngine,
  beatInBar,
  formatElapsed,
  pendulumAngle,
  type TimerMode,
  type TimerSnapshot,
} from '../../lib/timer-audio';
import styles from './IntervalTimer.module.css';

const INTERVAL_STORAGE_KEY = 'growrep_timer_interval';
const BPM_STORAGE_KEY = 'growrep_timer_bpm';
const MODE_STORAGE_KEY = 'growrep_timer_mode';

/**
 * インターバルタイマー。音の仕様（音量・周波数・長さ・鳴るタイミング）は
 * GitHub Pages 版 app.js と同一（lib/timer-audio.ts のミラー実装）。
 * 画面いっぱいに回数と時間を表示する。
 *
 * モードは2つ:
 * - インターバル: N秒ごとに1回（app.js と同じ挙動）
 * - BPM: 指定テンポの1拍ごとに1回。準備のカウントダウンも同じ拍で刻み、
 *   経過時間の位置には電子メトロノーム風の振り子を出す（web 版のみ）
 *
 * 設定はモード・秒数・BPM とも実行中に変更できる。変更した瞬間の回数と
 * 総経過時間は引き継がれ、そこから新しい刻みで数え直す。
 */
export default function IntervalTimer() {
  const engine = useMemo(() => new IntervalTimerEngine(), []);
  const [snap, setSnap] = useState<TimerSnapshot>(() => engine.snapshot());
  const [mode, setMode] = useState<TimerMode>(() =>
    localStorage.getItem(MODE_STORAGE_KEY) === 'bpm' ? 'bpm' : 'interval',
  );
  const [intervalSec, setIntervalSec] = useState(() => {
    const saved = Number(localStorage.getItem(INTERVAL_STORAGE_KEY));
    return saved >= INTERVAL_MIN && saved <= INTERVAL_MAX ? saved : 3;
  });
  const [bpm, setBpm] = useState(() => {
    const saved = Number(localStorage.getItem(BPM_STORAGE_KEY));
    return saved >= BPM_MIN && saved <= BPM_MAX ? saved : DEFAULT_BPM;
  });
  const beatRef = useRef(0);
  const [beating, setBeating] = useState(false);

  useEffect(() => engine.subscribe(setSnap), [engine]);
  useEffect(() => () => engine.destroy(), [engine]);

  // 実行中でも設定変更をそのまま反映する（停止させない）
  useEffect(() => {
    engine.setConfig({ mode, intervalSeconds: intervalSec, bpm });
  }, [engine, mode, intervalSec, bpm]);

  useEffect(() => {
    localStorage.setItem(INTERVAL_STORAGE_KEY, String(intervalSec));
  }, [intervalSec]);
  useEffect(() => {
    localStorage.setItem(BPM_STORAGE_KEY, String(bpm));
  }, [bpm]);
  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  // ビープに合わせた拍動アニメーション
  useEffect(() => {
    if (!snap.beatAt || snap.beatAt === beatRef.current) return;
    beatRef.current = snap.beatAt;
    setBeating(true);
    const id = window.setTimeout(() => setBeating(false), 300);
    return () => window.clearTimeout(id);
  }, [snap.beatAt]);

  const idle = snap.phase === 'idle';
  const prep = snap.phase === 'prep';
  const running = snap.phase === 'running';
  const isBpm = mode === 'bpm';
  const timeStr = formatElapsed(snap.elapsedSeconds);

  // 振り子は拍の境界でちょうど端に来るので、音と自動的に同期する
  const angle = running ? pendulumAngle(snap.gridElapsedMs, bpm) : 0;
  const activeBeat = running ? beatInBar(snap.gridElapsedMs, bpm) : -1;

  return (
    <div className={styles.screen}>
      <div
        className={styles.modeToggle}
        role="group"
        aria-label="タイマーモード"
      >
        <button
          type="button"
          className={!isBpm ? styles.modeOn : ''}
          aria-pressed={!isBpm}
          onClick={() => setMode('interval')}
        >
          <i className="fa-solid fa-stopwatch" /> インターバル
        </button>
        <button
          type="button"
          className={isBpm ? styles.modeOn : ''}
          aria-pressed={isBpm}
          onClick={() => setMode('bpm')}
        >
          <i className="fa-solid fa-music" /> BPM
        </button>
      </div>

      {/* key を分けて、モード切替時に入力途中の文字が残らないようにする */}
      {isBpm ? (
        <StepperField
          key="bpm"
          id="timer-bpm"
          label="テンポ"
          unit="BPM"
          min={BPM_MIN}
          max={BPM_MAX}
          value={bpm}
          decLabel="BPMを1下げる"
          incLabel="BPMを1上げる"
          onChange={setBpm}
        />
      ) : (
        <StepperField
          key="interval"
          id="timer-interval"
          label="インターバル"
          unit="秒"
          min={INTERVAL_MIN}
          max={INTERVAL_MAX}
          value={intervalSec}
          decLabel="1秒減らす"
          incLabel="1秒増やす"
          onChange={setIntervalSec}
        />
      )}

      <div className={styles.stage}>
        {prep ? (
          <div className={styles.prepBox}>
            <span className={styles.stageLabel}>準備時間</span>
            <span className={styles.prepNum}>{snap.prepCountdown}</span>
            {isBpm && (
              <span className={styles.metroMeta}>{bpm} BPM で刻み中</span>
            )}
          </div>
        ) : (
          <>
            <div className={styles.countBox}>
              <span className={styles.stageLabel}>回数</span>
              {/* 桁数を CSS に渡して、大きい数でも画面からはみ出さないようにする */}
              <span
                className={`${styles.countNum} ${beating ? styles.beat : ''}`}
                style={
                  { '--digits': String(snap.count).length } as CSSProperties
                }
              >
                {snap.count}
              </span>
            </div>
            {isBpm ? (
              <div className={styles.timeBox}>
                <span className={styles.stageLabel}>メトロノーム</span>
                <div
                  className={styles.metronome}
                  role="img"
                  aria-label={`メトロノーム ${bpm} BPM`}
                >
                  <div className={styles.pendulum}>
                    <span className={styles.base} />
                    <div
                      className={styles.arm}
                      style={{ transform: `rotate(${angle}deg)` }}
                    >
                      <span className={styles.weight} />
                    </div>
                    <span className={styles.pivot} />
                  </div>
                  <div className={styles.beatDots}>
                    {Array.from({ length: BEATS_PER_BAR }, (_, i) => (
                      <span
                        key={i}
                        className={i === activeBeat ? styles.dotOn : ''}
                      />
                    ))}
                  </div>
                </div>
                <span className={styles.metroMeta}>
                  {bpm} BPM ・ {timeStr}
                </span>
              </div>
            ) : (
              <div className={styles.timeBox}>
                <span className={styles.stageLabel}>経過時間</span>
                <span
                  className={styles.timeNum}
                  style={{ '--chars': timeStr.length } as CSSProperties}
                >
                  {timeStr}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.controls}>
        {idle ? (
          <button
            className={styles.startBtn}
            onClick={() =>
              engine.start({ mode, intervalSeconds: intervalSec, bpm })
            }
          >
            <i className="fa-solid fa-play" /> スタート
          </button>
        ) : (
          <button className={styles.stopBtn} onClick={() => engine.stop()}>
            <i className="fa-solid fa-pause" /> ストップ
          </button>
        )}
        <button className={styles.resetBtn} onClick={() => engine.reset()}>
          <i className="fa-solid fa-rotate-right" /> リセット
        </button>
      </div>
    </div>
  );
}

interface StepperFieldProps {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  decLabel: string;
  incLabel: string;
  onChange: (v: number) => void;
}

/**
 * 数値入力＋増減ボタン。
 * 入力中は打った文字をそのまま表示し（"12" と打つ途中で勝手に丸めない）、
 * 範囲内の数値になった時点で即反映、確定（blur/Enter）時に範囲へ丸める。
 */
function StepperField({
  id,
  label,
  unit,
  min,
  max,
  value,
  decLabel,
  incLabel,
  onChange,
}: StepperFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));

  const step = (delta: number) => {
    setDraft(null);
    onChange(clamp(value + delta));
  };

  const handleInput = (text: string) => {
    setDraft(text);
    const n = Number(text);
    // 範囲内の値になったら入力中でもそのまま反映する
    if (text.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) {
      onChange(Math.round(n));
    }
  };

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    onChange(draft.trim() !== '' && Number.isFinite(n) ? clamp(n) : value);
    setDraft(null);
  };

  return (
    <div className={styles.settingRow}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.stepper}>
        <button
          type="button"
          aria-label={decLabel}
          disabled={value <= min}
          onClick={() => step(-1)}
        >
          <i className="fa-solid fa-minus" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft ?? String(value)}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <button
          type="button"
          aria-label={incLabel}
          disabled={value >= max}
          onClick={() => step(1)}
        >
          <i className="fa-solid fa-plus" />
        </button>
        <span className={styles.stepperUnit}>{unit}</span>
      </div>
    </div>
  );
}
