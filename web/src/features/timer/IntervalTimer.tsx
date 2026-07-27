import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  IntervalTimerEngine,
  formatElapsed,
  type TimerSnapshot,
} from '../../lib/timer-audio';
import styles from './IntervalTimer.module.css';

const INTERVAL_STORAGE_KEY = 'growrep_timer_interval';

/**
 * インターバルタイマー。音の仕様（音量・周波数・長さ・鳴るタイミング）は
 * GitHub Pages 版 app.js と同一（lib/timer-audio.ts のミラー実装）。
 * 画面いっぱいに回数と時間を表示する。
 */
export default function IntervalTimer() {
  const engine = useMemo(() => new IntervalTimerEngine(), []);
  const [snap, setSnap] = useState<TimerSnapshot>(() => engine.snapshot());
  const [intervalSec, setIntervalSec] = useState(() => {
    const saved = Number(localStorage.getItem(INTERVAL_STORAGE_KEY));
    return saved >= 1 && saved <= 60 ? saved : 3;
  });
  const beatRef = useRef(0);
  const [beating, setBeating] = useState(false);

  useEffect(() => engine.subscribe(setSnap), [engine]);
  useEffect(() => () => engine.destroy(), [engine]);

  useEffect(() => {
    localStorage.setItem(INTERVAL_STORAGE_KEY, String(intervalSec));
  }, [intervalSec]);

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
  const timeStr = formatElapsed(snap.elapsedSeconds);

  return (
    <div className={styles.screen}>
      <div className={styles.settingRow}>
        <label htmlFor="timer-interval">インターバル</label>
        <div className={styles.stepper}>
          <button
            type="button"
            aria-label="1秒減らす"
            disabled={!idle || intervalSec <= 1}
            onClick={() => setIntervalSec((v) => Math.max(1, v - 1))}
          >
            <i className="fa-solid fa-minus" />
          </button>
          <input
            id="timer-interval"
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={intervalSec}
            disabled={!idle}
            onChange={(e) =>
              setIntervalSec(
                Math.max(1, Math.min(60, Number(e.target.value) || 1)),
              )
            }
          />
          <button
            type="button"
            aria-label="1秒増やす"
            disabled={!idle || intervalSec >= 60}
            onClick={() => setIntervalSec((v) => Math.min(60, v + 1))}
          >
            <i className="fa-solid fa-plus" />
          </button>
          <span className={styles.stepperUnit}>秒</span>
        </div>
      </div>

      <div className={styles.stage}>
        {prep ? (
          <div className={styles.prepBox}>
            <span className={styles.stageLabel}>準備時間</span>
            <span className={styles.prepNum}>{snap.prepCountdown}</span>
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
            <div className={styles.timeBox}>
              <span className={styles.stageLabel}>経過時間</span>
              <span
                className={styles.timeNum}
                style={{ '--chars': timeStr.length } as CSSProperties}
              >
                {timeStr}
              </span>
            </div>
          </>
        )}
      </div>

      <div className={styles.controls}>
        {idle ? (
          <button
            className={styles.startBtn}
            onClick={() => engine.start(intervalSec)}
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
