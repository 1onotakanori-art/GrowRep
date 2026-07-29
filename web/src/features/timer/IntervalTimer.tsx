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
  IntervalTimerEngine,
  beatInBar,
  clampBpm,
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
 * - BPM: 指定テンポの1拍ごとに1回。経過時間の位置には電子メトロノーム風の
 *   振り子アニメーションを出す（web 版のみの機能）
 */
export default function IntervalTimer() {
  const engine = useMemo(() => new IntervalTimerEngine(), []);
  const [snap, setSnap] = useState<TimerSnapshot>(() => engine.snapshot());
  const [mode, setMode] = useState<TimerMode>(() =>
    localStorage.getItem(MODE_STORAGE_KEY) === 'bpm' ? 'bpm' : 'interval',
  );
  const [intervalSec, setIntervalSec] = useState(() => {
    const saved = Number(localStorage.getItem(INTERVAL_STORAGE_KEY));
    return saved >= 1 && saved <= 60 ? saved : 3;
  });
  const [bpm, setBpm] = useState(() => {
    const saved = Number(localStorage.getItem(BPM_STORAGE_KEY));
    return saved >= BPM_MIN && saved <= BPM_MAX ? saved : DEFAULT_BPM;
  });
  const beatRef = useRef(0);
  const [beating, setBeating] = useState(false);

  useEffect(() => engine.subscribe(setSnap), [engine]);
  useEffect(() => () => engine.destroy(), [engine]);

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
  const angle = running ? pendulumAngle(snap.elapsedMs, bpm) : 0;
  const activeBeat = running ? beatInBar(snap.elapsedMs, bpm) : -1;

  return (
    <div className={styles.screen}>
      <div className={styles.modeToggle} role="group" aria-label="タイマーモード">
        <button
          type="button"
          className={!isBpm ? styles.modeOn : ''}
          aria-pressed={!isBpm}
          disabled={!idle}
          onClick={() => setMode('interval')}
        >
          <i className="fa-solid fa-stopwatch" /> インターバル
        </button>
        <button
          type="button"
          className={isBpm ? styles.modeOn : ''}
          aria-pressed={isBpm}
          disabled={!idle}
          onClick={() => setMode('bpm')}
        >
          <i className="fa-solid fa-music" /> BPM
        </button>
      </div>

      {isBpm ? (
        <div className={styles.settingRow}>
          <label htmlFor="timer-bpm">テンポ</label>
          <div className={styles.stepper}>
            <button
              type="button"
              aria-label="BPMを1下げる"
              disabled={!idle || bpm <= BPM_MIN}
              onClick={() => setBpm((v) => clampBpm(v - 1))}
            >
              <i className="fa-solid fa-minus" />
            </button>
            <input
              id="timer-bpm"
              type="number"
              inputMode="numeric"
              min={BPM_MIN}
              max={BPM_MAX}
              value={bpm}
              disabled={!idle}
              onChange={(e) =>
                setBpm(clampBpm(Number(e.target.value) || DEFAULT_BPM))
              }
            />
            <button
              type="button"
              aria-label="BPMを1上げる"
              disabled={!idle || bpm >= BPM_MAX}
              onClick={() => setBpm((v) => clampBpm(v + 1))}
            >
              <i className="fa-solid fa-plus" />
            </button>
            <span className={styles.stepperUnit}>BPM</span>
          </div>
        </div>
      ) : (
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
      )}

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
