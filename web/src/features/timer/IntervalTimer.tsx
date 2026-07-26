import { useEffect, useRef, useState } from 'react';
import styles from './IntervalTimer.module.css';

const PREP_SECONDS = 10;

function beep(
  ctx: AudioContext,
  freq: number,
  duration: number,
  volume: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

type Phase = 'idle' | 'prep' | 'running';

/** インターバルタイマー（バーバリアン種目のペース管理用）。 */
export default function IntervalTimer() {
  const [interval, setIntervalSec] = useState(3);
  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [prepLeft, setPrepLeft] = useState(PREP_SECONDS);

  const audioRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const nextTickRef = useRef(0);
  const prepStartRef = useRef(0);
  const lastPrepSecRef = useRef(-1);

  function ensureAudio() {
    if (!audioRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioRef.current = new Ctx();
    }
    if (audioRef.current.state === 'suspended') audioRef.current.resume();
    return audioRef.current;
  }

  function stopLoop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  function reset() {
    stopLoop();
    setPhase('idle');
    setCount(0);
    setElapsed(0);
    setPrepLeft(PREP_SECONDS);
  }

  function start() {
    const ctx = ensureAudio();
    setCount(0);
    setElapsed(0);
    setPrepLeft(PREP_SECONDS);
    lastPrepSecRef.current = -1;
    prepStartRef.current = performance.now();
    setPhase('prep');

    const prepLoop = () => {
      const el = (performance.now() - prepStartRef.current) / 1000;
      const left = Math.ceil(PREP_SECONDS - el);
      setPrepLeft(Math.max(0, left));
      if (left !== lastPrepSecRef.current && left > 0 && left <= PREP_SECONDS) {
        lastPrepSecRef.current = left;
        beep(ctx, 660, 0.15, 0.4);
      }
      if (el >= PREP_SECONDS) {
        beginRunning(ctx);
        return;
      }
      rafRef.current = requestAnimationFrame(prepLoop);
    };
    rafRef.current = requestAnimationFrame(prepLoop);
  }

  function beginRunning(ctx: AudioContext) {
    setPhase('running');
    setCount(1);
    beep(ctx, 880, 0.25, 0.6);
    startRef.current = performance.now();
    nextTickRef.current = interval;

    const runLoop = () => {
      const el = (performance.now() - startRef.current) / 1000;
      setElapsed(el);
      if (el >= nextTickRef.current) {
        setCount((c) => c + 1);
        beep(ctx, 880, 0.25, 0.6);
        nextTickRef.current += interval;
      }
      rafRef.current = requestAnimationFrame(runLoop);
    };
    rafRef.current = requestAnimationFrame(runLoop);
  }

  function stop() {
    stopLoop();
    setPhase('idle');
  }

  useEffect(() => () => stopLoop(), []);

  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60);
  const timeStr = `${mm}:${String(ss).padStart(2, '0')}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.settingRow}>
        <label>インターバル（秒）</label>
        <input
          type="number"
          min={1}
          max={60}
          value={interval}
          disabled={phase !== 'idle'}
          onChange={(e) =>
            setIntervalSec(Math.max(1, Math.min(60, Number(e.target.value) || 1)))
          }
        />
      </div>

      <div className={styles.display}>
        {phase === 'prep' ? (
          <div className={styles.prep}>
            <span className={styles.prepLabel}>準備</span>
            <span className={styles.prepNum}>{prepLeft}</span>
          </div>
        ) : (
          <>
            <div className={styles.countBox}>
              <span className={styles.countLabel}>回数</span>
              <span className={styles.countNum}>{count}</span>
            </div>
            <div className={styles.timeBox}>
              <span className={styles.timeLabel}>経過</span>
              <span className={styles.timeNum}>{timeStr}</span>
            </div>
          </>
        )}
      </div>

      <div className={styles.controls}>
        {phase === 'idle' ? (
          <button className={styles.startBtn} onClick={start}>
            <i className="fa-solid fa-play" /> スタート
          </button>
        ) : (
          <button className={styles.stopBtn} onClick={stop}>
            <i className="fa-solid fa-pause" /> ストップ
          </button>
        )}
        <button className={styles.resetBtn} onClick={reset}>
          <i className="fa-solid fa-rotate-right" /> リセット
        </button>
      </div>
    </div>
  );
}
