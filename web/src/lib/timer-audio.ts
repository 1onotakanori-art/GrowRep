// =====================================================================
// インターバルタイマー 音・進行ロジック
// ⚠️ 既存 app.js のタイマー実装（playTickSound / playBeepSound /
//    playCountdownSound / scheduleUpcomingAudio / startTimer 相当）の
//    「ミラー」。音量・周波数・長さ・減衰・鳴るタイミングを変えないこと。
//    app.js 側を変更した場合はこのファイルも必ず同じに更新する。
// =====================================================================

/** 準備フェーズの秒数。app.js: preparationCountdown = 10 */
export const PREP_SECONDS = 10;

/** 状態更新ポーリング間隔 (ms)。app.js: TIMER_POLL_MS */
export const TIMER_POLL_MS = 200;

/** 音声先読みスケジュール時間 (秒)。app.js: AUDIO_LOOKAHEAD_SEC */
export const AUDIO_LOOKAHEAD_SEC = 0.3;

/** マスターボリューム。app.js: masterVolume */
export const MASTER_VOLUME = 1.0;

/**
 * スケジュール再生時の減衰量（終端音量 = 開始音量 / この値）。
 * app.js: scheduleOscillator の endVol = volume / 50
 */
export const DECAY_DIVISOR = 50;

export interface SoundSpec {
  /** 個別音量 (0-1)。app.js: *SoundVolume */
  volume: number;
  /** 周波数 (Hz)。app.js: *SoundFrequency */
  frequency: number;
  /** 長さ (秒)。app.js: *SoundDuration */
  duration: number;
}

/** チック音: 毎秒の小さな音。app.js: tickSound* */
export const TICK_SOUND: SoundSpec = {
  volume: 1.0,
  frequency: 440,
  duration: 0.3,
};

/** ビープ音: インターバルごとの大きな音。app.js: beepSound* */
export const BEEP_SOUND: SoundSpec = {
  volume: 1.0,
  frequency: 880,
  duration: 0.6,
};

/** カウントダウン音: 準備時間の音。app.js: countdownSound* */
export const COUNTDOWN_SOUND: SoundSpec = {
  volume: 0.5,
  frequency: 660,
  duration: 0.3,
};

export type SoundKind = 'tick' | 'beep' | 'countdown';

// ---------------------------------------------------------------------
// 純粋関数（テスト対象）
// ---------------------------------------------------------------------

/** マスター×個別の複合音量。app.js: getComputedVolume */
export function getComputedVolume(
  individualVolume: number,
  master: number = MASTER_VOLUME,
): number {
  return Math.max(0, Math.min(1, individualVolume * master));
}

/**
 * メインフェーズの経過秒に鳴らす音の種類。
 * app.js: nextScheduledSecond % intervalSeconds === 0 ? beep : tick
 */
export function soundKindForSecond(
  second: number,
  intervalSeconds: number,
): 'beep' | 'tick' {
  return second % intervalSeconds === 0 ? 'beep' : 'tick';
}

/**
 * 準備フェーズでカウントダウン音が鳴る経過秒の一覧（1〜9）。
 * app.js: nextScheduledPrepSecond = 1 から while (<= 9)
 */
export function prepBeepSeconds(): number[] {
  return Array.from({ length: PREP_SECONDS - 1 }, (_, i) => i + 1);
}

/** 経過秒から回数表示。app.js: currentCount = 1 + Math.floor(elapsed / interval) */
export function countAtElapsed(
  elapsedSeconds: number,
  intervalSeconds: number,
): number {
  return 1 + Math.floor(elapsedSeconds / intervalSeconds);
}

/** 経過秒を M:SS 表記に。app.js: updateTimerDisplay */
export function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 準備の残り秒。app.js: Math.max(0, 10 - prepElapsed) */
export function prepCountdownAt(prepElapsedSeconds: number): number {
  return Math.max(0, PREP_SECONDS - prepElapsedSeconds);
}

/** 音種別のスペックを引く。 */
export function specFor(kind: SoundKind): SoundSpec {
  if (kind === 'tick') return TICK_SOUND;
  if (kind === 'beep') return BEEP_SOUND;
  return COUNTDOWN_SOUND;
}

/**
 * ゲイン包絡の開始／終了音量。app.js: scheduleOscillator
 * startVol = max(0.001, vol), endVol = max(0.001, vol / 50)
 */
export function envelopeFor(kind: SoundKind): {
  startVolume: number;
  endVolume: number;
  duration: number;
  frequency: number;
} {
  const spec = specFor(kind);
  const vol = getComputedVolume(spec.volume);
  return {
    startVolume: Math.max(0.001, vol),
    endVolume: Math.max(0.001, vol / DECAY_DIVISOR),
    duration: spec.duration,
    frequency: spec.frequency,
  };
}

// ---------------------------------------------------------------------
// タイマーエンジン（React 非依存）
// ---------------------------------------------------------------------

export type TimerPhase = 'idle' | 'prep' | 'running';

export interface TimerSnapshot {
  phase: TimerPhase;
  /** 回数（メインフェーズのみ意味を持つ） */
  count: number;
  /** 経過秒（メインフェーズのみ） */
  elapsedSeconds: number;
  /** 準備の残り秒（準備フェーズのみ） */
  prepCountdown: number;
  /** ビープと同時に立つ視覚フィードバック用フラグ */
  beatAt: number;
}

type Listener = (s: TimerSnapshot) => void;

/**
 * app.js のタイマーと同じ挙動を持つエンジン。
 * - AudioContext のハードウェアクロックに先読みスケジュールするため、
 *   JS の実行ブレやタブ非アクティブ化に強い
 * - サイレント音声ループ + Wake Lock でロック画面でも鳴り続ける
 * - 復帰時に経過を実時間から再計算して補正する
 */
export class IntervalTimerEngine {
  private ctx: AudioContext | null = null;
  private silentAudio: HTMLAudioElement | null = null;
  private wakeLock: WakeLockSentinel | null = null;

  private phase: TimerPhase = 'idle';
  private intervalSeconds = 3;
  private prepStartTime: number | null = null;
  private timerStartTime: number | null = null;
  private elapsedSeconds = 0;
  private count = 0;
  private prepCountdown = PREP_SECONDS;
  private beatAt = 0;

  private audioTimeOffset = 0;
  private nextScheduledSecond = 0;
  private nextScheduledPrepSecond = 0;
  private scheduledNodes: OscillatorNode[] = [];

  private pollId: number | null = null;
  private rafId: number | null = null;
  private listeners = new Set<Listener>();
  private onVisibility: () => void;

  constructor() {
    this.onVisibility = () => this.handleVisibilityChange();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  // --- 購読 ---------------------------------------------------------

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  snapshot(): TimerSnapshot {
    return {
      phase: this.phase,
      count: this.count,
      elapsedSeconds: this.elapsedSeconds,
      prepCountdown: this.prepCountdown,
      beatAt: this.beatAt,
    };
  }

  private emit() {
    const s = this.snapshot();
    this.listeners.forEach((fn) => fn(s));
  }

  // --- AudioContext -------------------------------------------------

  private initAudio(): AudioContext | null {
    if (!this.ctx) {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        this.ctx = new Ctor();
      } catch (e) {
        console.error('[タイマー] AudioContext初期化失敗:', e);
        return null;
      }
    }
    return this.ctx;
  }

  /** app.js: calibrateAudioTimeOffset */
  private calibrate() {
    if (this.ctx && this.ctx.state === 'running') {
      this.audioTimeOffset = Date.now() / 1000 - this.ctx.currentTime;
    }
  }

  /** app.js: wallMsToAudioTime */
  private wallMsToAudioTime(wallMs: number): number {
    return wallMs / 1000 - this.audioTimeOffset;
  }

  /** app.js: scheduleOscillator */
  private scheduleOscillator(kind: SoundKind, when?: number) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    try {
      const now = ctx.currentTime;
      const startTime = when !== undefined && when > now ? when : now;
      const { startVolume, endVolume, duration, frequency } = envelopeFor(kind);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = frequency;
      osc.type = 'sine';

      gain.gain.setValueAtTime(startVolume, startTime);
      gain.gain.exponentialRampToValueAtTime(endVolume, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration);
      this.scheduledNodes.push(osc);

      if (kind === 'beep') {
        // 視覚フィードバックを音のタイミングに合わせる
        const delay = Math.max(0, (startTime - now) * 1000);
        window.setTimeout(() => {
          this.beatAt = Date.now();
          this.emit();
        }, delay);
      }
    } catch (e) {
      console.error('[タイマー] 音のスケジュールに失敗:', e);
    }
  }

  private cancelScheduledNodes() {
    for (const node of this.scheduledNodes) {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
    }
    this.scheduledNodes = [];
  }

  /** app.js: scheduleUpcomingAudio */
  private scheduleUpcoming() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }

    const nowAudio = ctx.currentTime;
    const lookAheadUntil = nowAudio + AUDIO_LOOKAHEAD_SEC;

    if (this.phase === 'prep' && this.prepStartTime) {
      // 長時間バックグラウンドからの復帰時に高速スキップ
      const currentPrepSecond = Math.floor(
        (Date.now() - this.prepStartTime) / 1000,
      );
      if (this.nextScheduledPrepSecond < currentPrepSecond - 1) {
        this.nextScheduledPrepSecond = Math.max(1, currentPrepSecond - 1);
      }
      while (this.nextScheduledPrepSecond <= PREP_SECONDS - 1) {
        const wallMs =
          this.prepStartTime + this.nextScheduledPrepSecond * 1000;
        const audioTime = this.wallMsToAudioTime(wallMs);
        if (audioTime > lookAheadUntil) break;
        if (audioTime >= nowAudio - 0.3) {
          this.scheduleOscillator('countdown', Math.max(audioTime, nowAudio));
        }
        this.nextScheduledPrepSecond++;
      }
    } else if (this.phase === 'running' && this.timerStartTime) {
      const currentSecond = Math.floor(
        (Date.now() - this.timerStartTime) / 1000,
      );
      if (this.nextScheduledSecond < currentSecond - 1) {
        this.nextScheduledSecond = Math.max(0, currentSecond - 1);
      }
      let safety = 0;
      while (safety++ < 100) {
        const wallMs = this.timerStartTime + this.nextScheduledSecond * 1000;
        const audioTime = this.wallMsToAudioTime(wallMs);
        if (audioTime > lookAheadUntil) break;
        if (audioTime >= nowAudio - 0.3) {
          const kind = soundKindForSecond(
            this.nextScheduledSecond,
            this.intervalSeconds,
          );
          this.scheduleOscillator(kind, Math.max(audioTime, nowAudio));
        }
        this.nextScheduledSecond++;
      }
    }

    if (this.scheduledNodes.length > 50) {
      this.scheduledNodes = this.scheduledNodes.slice(-20);
    }
  }

  // --- ロック画面対策 -----------------------------------------------

  /** app.js: startSilentAudioKeepAlive */
  private startKeepAlive() {
    if (this.silentAudio) return;
    try {
      const el = new Audio(
        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
      );
      el.loop = true;
      el.volume = 0.01;
      el.play().catch(() => {
        this.silentAudio = null;
      });
      this.silentAudio = el;
    } catch {
      this.silentAudio = null;
    }
  }

  private stopKeepAlive() {
    if (this.silentAudio) {
      this.silentAudio.pause();
      this.silentAudio.src = '';
      this.silentAudio = null;
    }
  }

  /** app.js: requestWakeLock */
  private async requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      /* 未対応・拒否は無視 */
    }
  }

  private releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  /** app.js: visibilitychange ハンドラ */
  private handleVisibilityChange() {
    if (document.visibilityState !== 'visible') return;
    const running = this.phase !== 'idle';

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx
        .resume()
        .then(() => {
          if (running) {
            this.calibrate();
            this.scheduleUpcoming();
          }
        })
        .catch(() => {});
    }
    if (running && this.silentAudio && this.silentAudio.paused) {
      this.silentAudio.play().catch(() => {});
    }
    if (running) this.requestWakeLock();

    // 復帰時に実時間から経過を再計算
    if (this.phase === 'running' && this.timerStartTime) {
      const realElapsed = Math.floor((Date.now() - this.timerStartTime) / 1000);
      if (realElapsed > this.elapsedSeconds) {
        this.elapsedSeconds = realElapsed;
        this.count = countAtElapsed(this.elapsedSeconds, this.intervalSeconds);
        this.emit();
      }
      this.calibrate();
      this.scheduleUpcoming();
    }
  }

  // --- 操作 ---------------------------------------------------------

  /** app.js: startTimer */
  async start(intervalSeconds: number) {
    if (this.phase !== 'idle') return;
    this.intervalSeconds = Math.max(1, Math.min(60, intervalSeconds || 3));

    const ctx = this.initAudio();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.error('[タイマー] AudioContext再開失敗:', e);
      }
    }

    this.startKeepAlive();
    this.requestWakeLock();

    this.phase = 'prep';
    this.prepCountdown = PREP_SECONDS;
    this.prepStartTime = Date.now();
    this.timerStartTime = null;
    this.elapsedSeconds = 0;
    this.count = 0;
    this.nextScheduledPrepSecond = 1; // 最初のカウントダウン音は1秒後
    this.nextScheduledSecond = 0;
    this.emit();

    this.calibrate();

    this.pollId = window.setInterval(() => this.poll(), TIMER_POLL_MS);
    this.rafId = requestAnimationFrame(() => this.uiLoop());
  }

  /** app.js: startTimer 内の setInterval コールバック */
  private poll() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (this.phase === 'prep' && this.prepStartTime) {
      const prepElapsed = Math.floor((Date.now() - this.prepStartTime) / 1000);
      this.prepCountdown = prepCountdownAt(prepElapsed);

      if (this.prepCountdown <= 0) {
        // 準備終了 → メインフェーズ
        this.phase = 'running';
        this.elapsedSeconds = 0;
        this.count = 1;
        this.timerStartTime = this.prepStartTime + PREP_SECONDS * 1000;

        this.calibrate();
        this.nextScheduledSecond = 0;

        if (this.ctx && this.ctx.state === 'running') {
          const firstBeep = this.wallMsToAudioTime(this.timerStartTime);
          this.scheduleOscillator(
            'beep',
            Math.max(firstBeep, this.ctx.currentTime),
          );
          this.nextScheduledSecond = 1; // 秒0はスケジュール済み
        }
      }
    } else if (this.phase === 'running' && this.timerStartTime) {
      this.elapsedSeconds = Math.floor(
        (Date.now() - this.timerStartTime) / 1000,
      );
      this.count = countAtElapsed(this.elapsedSeconds, this.intervalSeconds);
    }

    this.calibrate();
    this.scheduleUpcoming();
    this.emit();
  }

  /** app.js: timerUILoop */
  private uiLoop() {
    if (this.phase === 'idle') return;

    if (this.phase === 'prep' && this.prepStartTime) {
      const prepElapsed = Math.floor((Date.now() - this.prepStartTime) / 1000);
      this.prepCountdown = prepCountdownAt(prepElapsed);
    } else if (this.phase === 'running' && this.timerStartTime) {
      this.elapsedSeconds = Math.floor(
        (Date.now() - this.timerStartTime) / 1000,
      );
      this.count = countAtElapsed(this.elapsedSeconds, this.intervalSeconds);
    }
    this.emit();
    this.rafId = requestAnimationFrame(() => this.uiLoop());
  }

  /** app.js: stopTimer */
  stop() {
    if (this.phase === 'idle') return;

    if (this.pollId !== null) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.phase = 'idle';
    this.cancelScheduledNodes();
    this.stopKeepAlive();
    this.releaseWakeLock();

    const ctx = this.initAudio();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});

    this.emit();
  }

  /** app.js: resetTimer（テスト音つき） */
  async reset() {
    this.stop();
    this.count = 0;
    this.elapsedSeconds = 0;
    this.prepCountdown = PREP_SECONDS;
    this.prepStartTime = null;
    this.timerStartTime = null;
    this.nextScheduledSecond = 0;
    this.nextScheduledPrepSecond = 0;
    this.emit();
    await this.playTestSound();
  }

  /** app.js: playTestSound（ビープ音量の 0.8 倍、0.3 秒） */
  async playTestSound(): Promise<boolean> {
    const ctx = this.initAudio();
    if (!ctx) return false;
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = BEEP_SOUND.frequency;
      osc.type = 'sine';
      const volume = getComputedVolume(BEEP_SOUND.volume) * 0.8;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
      return true;
    } catch (e) {
      console.error('[タイマー] テスト音再生失敗:', e);
      return false;
    }
  }

  destroy() {
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.listeners.clear();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
