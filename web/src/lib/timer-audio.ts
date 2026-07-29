// =====================================================================
// インターバルタイマー 音・進行ロジック
// ⚠️ 既存 app.js のタイマー実装（playTickSound / playBeepSound /
//    playCountdownSound / scheduleUpcomingAudio / startTimer 相当）の
//    「ミラー」。音量・周波数・長さ・減衰・鳴るタイミングを変えないこと。
//    app.js 側を変更した場合はこのファイルも必ず同じに更新する。
//
// 📝 BPMモード（mode: 'bpm'）は web 版だけの追加機能で app.js には無い。
//    インターバルモード側の音・タイミングには一切手を入れていない。
// =====================================================================

/**
 * 準備フェーズの刻み数。app.js: preparationCountdown = 10
 * インターバルモードでは 1 刻み = 1 秒（＝10秒）、
 * BPMモードでは 1 刻み = 1 拍（＝10拍ぶんの時間）。
 */
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

// --- BPMモード（web 版のみ） ------------------------------------------

/** タイマーの動作モード。'interval' = 秒指定、'bpm' = テンポ指定 */
export type TimerMode = 'interval' | 'bpm';

/** タイマーの設定。start() / setConfig() に渡す */
export interface TimerConfig {
  mode: TimerMode;
  /** mode === 'interval' のときの秒数 */
  intervalSeconds: number;
  /** mode === 'bpm' のときのテンポ */
  bpm: number;
}

export const INTERVAL_MIN = 1;
export const INTERVAL_MAX = 60;

export function clampIntervalSeconds(sec: number): number {
  if (!Number.isFinite(sec)) return 3;
  return Math.max(INTERVAL_MIN, Math.min(INTERVAL_MAX, Math.round(sec)));
}

/** 設定を正規化する（範囲外・NaN を丸める） */
export function normalizeConfig(config: TimerConfig): TimerConfig {
  return {
    mode: config.mode === 'bpm' ? 'bpm' : 'interval',
    intervalSeconds: clampIntervalSeconds(config.intervalSeconds),
    bpm: clampBpm(config.bpm),
  };
}

export const BPM_MIN = 30;
export const BPM_MAX = 300;
export const DEFAULT_BPM = 60;

/** 1小節のビート数（メトロノームのドット表示用） */
export const BEATS_PER_BAR = 4;

/** 振り子の最大振れ角（度） */
export const PENDULUM_MAX_DEG = 26;

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return DEFAULT_BPM;
  return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(bpm)));
}

/** 1拍の長さ（秒）。60 BPM なら 1 秒。 */
export function beatPeriodSeconds(bpm: number): number {
  return 60 / clampBpm(bpm);
}

/** 経過秒から回数表示（BPM版）。1拍ごとに1回。 */
export function countAtElapsedBpm(elapsedSeconds: number, bpm: number): number {
  return 1 + Math.floor(elapsedSeconds / beatPeriodSeconds(bpm));
}

/**
 * BPM版のビープ長。速いテンポで音が重なって濁らないよう、
 * 1拍の半分を上限にする（遅いテンポでは通常のビープと同じ 0.6 秒）。
 */
export function bpmBeepDuration(bpm: number): number {
  return Math.min(BEEP_SOUND.duration, beatPeriodSeconds(bpm) / 2);
}

/** BPM版のカウントダウン音の長さ。ビープと同じく1拍の半分を上限にする。 */
export function bpmCountdownDuration(bpm: number): number {
  return Math.min(COUNTDOWN_SOUND.duration, beatPeriodSeconds(bpm) / 2);
}

/**
 * 振り子の角度（度）。拍のちょうど境界で左右いずれかの端に来るので、
 * 音とアニメーションが自動的に同期する。
 */
export function pendulumAngle(
  elapsedMs: number,
  bpm: number,
  maxDeg: number = PENDULUM_MAX_DEG,
): number {
  const periodMs = beatPeriodSeconds(bpm) * 1000;
  return maxDeg * Math.cos((Math.PI * elapsedMs) / periodMs);
}

/** 小節内の何拍目か（0 起点） */
export function beatInBar(
  elapsedMs: number,
  bpm: number,
  beatsPerBar: number = BEATS_PER_BAR,
): number {
  const periodMs = beatPeriodSeconds(bpm) * 1000;
  return Math.floor(Math.max(0, elapsedMs) / periodMs) % beatsPerBar;
}

// --- モード共通のグリッド（音と回数の刻み） ---------------------------

/**
 * 音をスケジュールする刻み（秒）。
 * インターバルモードは毎秒（チック／ビープ）、BPMモードは1拍ごと。
 */
export function scheduleStepSeconds(config: TimerConfig): number {
  return config.mode === 'bpm'
    ? beatPeriodSeconds(config.bpm)
    : 1;
}

/** 回数が1増える刻み（秒） */
export function countStepSeconds(config: TimerConfig): number {
  return config.mode === 'bpm'
    ? beatPeriodSeconds(config.bpm)
    : clampIntervalSeconds(config.intervalSeconds);
}

/** 準備フェーズの1刻みの長さ（秒）。BPMモードでは1拍ぶん。 */
export function prepStepSeconds(config: TimerConfig): number {
  return config.mode === 'bpm' ? beatPeriodSeconds(config.bpm) : 1;
}

/** メインフェーズの刻み番号に鳴らす音の種類 */
export function soundKindForStep(
  step: number,
  config: TimerConfig,
): 'beep' | 'tick' {
  // BPMモードは毎拍が1回なので常にビープ
  if (config.mode === 'bpm') return 'beep';
  return soundKindForSecond(step, clampIntervalSeconds(config.intervalSeconds));
}

/**
 * 音の長さ。BPMモードだけ1拍の半分を上限に短縮する
 * （インターバルモードは app.js と同じ既定値なので undefined を返す）。
 */
export function soundDurationForStep(
  kind: SoundKind,
  config: TimerConfig,
): number | undefined {
  if (config.mode !== 'bpm') return undefined;
  return kind === 'countdown'
    ? bpmCountdownDuration(config.bpm)
    : bpmBeepDuration(config.bpm);
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
  /** 経過ミリ秒。総経過時間の表示用 */
  elapsedMs: number;
  /**
   * 現在のグリッド原点からの経過ミリ秒。メトロノーム振り子の描画に使う。
   * 実行中にテンポを変えると原点が貼り直されるので、総経過とは別に持つ。
   */
  gridElapsedMs: number;
  /** 準備の残りカウント（準備フェーズのみ） */
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
  private config: TimerConfig = {
    mode: 'interval',
    intervalSeconds: 3,
    bpm: DEFAULT_BPM,
  };

  /** 準備フェーズのグリッド原点 */
  private prepGridStart: number | null = null;
  /** グリッド原点時点の残りカウント（通常は10。途中変更時はその時の残り） */
  private prepBase = PREP_SECONDS;
  private prepCountdown = PREP_SECONDS;

  /** 総経過時間の原点。設定を変えても動かさない */
  private timerStartTime: number | null = null;
  /** 音と回数のグリッド原点。設定変更時に「今」へ貼り直す */
  private gridStartTime: number | null = null;
  /** グリッド原点時点の回数 */
  private countBase = 1;

  private elapsedSeconds = 0;
  private elapsedMs = 0;
  private gridElapsedMs = 0;
  private count = 0;
  private beatAt = 0;

  private audioTimeOffset = 0;
  /** 次にスケジュールするメインフェーズの刻み番号（0 起点） */
  private nextScheduledStep = 0;
  /** 次にスケジュールする準備フェーズの刻み番号（1 起点） */
  private nextScheduledPrepStep = 0;
  private scheduledNodes: OscillatorNode[] = [];
  /** 拍動アニメーション用に予約した setTimeout */
  private beatTimeouts: number[] = [];

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
      elapsedMs: this.elapsedMs,
      gridElapsedMs: this.gridElapsedMs,
      prepCountdown: this.prepCountdown,
      beatAt: this.beatAt,
    };
  }

  /**
   * 実行中でも設定を差し替えられる。回数と総経過時間は引き継いだまま、
   * 音と回数のグリッドだけを「今」から新しい刻みで貼り直す。
   * こうすると設定変更で回数が飛んだり、余分な音が鳴ったりしない。
   */
  setConfig(next: TimerConfig) {
    const normalized = normalizeConfig(next);
    if (
      normalized.mode === this.config.mode &&
      normalized.intervalSeconds === this.config.intervalSeconds &&
      normalized.bpm === this.config.bpm
    ) {
      return;
    }

    const now = Date.now();
    if (this.phase === 'prep' && this.prepGridStart !== null) {
      // 残りカウントはそのまま、新しいテンポで刻み直す
      this.prepBase = Math.max(1, this.prepCountdown);
      this.prepGridStart = now;
      this.nextScheduledPrepStep = 1;
    } else if (this.phase === 'running' && this.gridStartTime !== null) {
      // 変更時点の回数を引き継ぎ、次の刻みから数え直す
      this.countBase = this.count;
      this.gridStartTime = now;
      this.nextScheduledStep = 1; // 変更の瞬間には鳴らさない
      this.gridElapsedMs = 0;
    }

    this.config = normalized;

    if (this.phase !== 'idle') {
      // 旧テンポで先読み済みの音を取り消してから貼り直す
      this.cancelScheduledNodes();
      this.calibrate();
      this.scheduleUpcoming();
      this.emit();
    }
  }

  /** メインフェーズの経過と回数を更新する */
  private updateElapsed(now: number) {
    if (this.timerStartTime === null || this.gridStartTime === null) return;
    this.elapsedMs = Math.max(0, now - this.timerStartTime);
    this.elapsedSeconds = Math.floor(this.elapsedMs / 1000);
    this.gridElapsedMs = Math.max(0, now - this.gridStartTime);
    this.count =
      this.countBase +
      Math.floor(this.gridElapsedMs / (countStepSeconds(this.config) * 1000));
  }

  /** 準備フェーズの残りカウントを更新する */
  private updatePrep(now: number) {
    if (this.prepGridStart === null) return;
    const steps = Math.floor(
      (now - this.prepGridStart) / (prepStepSeconds(this.config) * 1000),
    );
    this.prepCountdown = Math.max(0, this.prepBase - steps);
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

  /**
   * app.js: scheduleOscillator
   * durationOverride は BPMモード専用（速いテンポで音を短く切るため）。
   */
  private scheduleOscillator(
    kind: SoundKind,
    when?: number,
    durationOverride?: number,
  ) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    try {
      const now = ctx.currentTime;
      const startTime = when !== undefined && when > now ? when : now;
      const {
        startVolume,
        endVolume,
        duration: baseDuration,
        frequency,
      } = envelopeFor(kind);
      const duration = durationOverride ?? baseDuration;

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
        this.beatTimeouts.push(
          window.setTimeout(() => {
            this.beatAt = Date.now();
            this.emit();
          }, delay),
        );
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
    for (const id of this.beatTimeouts) window.clearTimeout(id);
    this.beatTimeouts = [];
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

    if (this.phase === 'prep' && this.prepGridStart !== null) {
      // BPMモードでは1刻み = 1拍。インターバルモードでは 1秒（app.js と同じ）
      const stepMs = prepStepSeconds(this.config) * 1000;
      const duration = soundDurationForStep('countdown', this.config);
      // 長時間バックグラウンドからの復帰時に高速スキップ
      const currentStep = Math.floor(
        (Date.now() - this.prepGridStart) / stepMs,
      );
      if (this.nextScheduledPrepStep < currentStep - 1) {
        this.nextScheduledPrepStep = Math.max(1, currentStep - 1);
      }
      while (this.nextScheduledPrepStep <= this.prepBase - 1) {
        const wallMs = this.prepGridStart + this.nextScheduledPrepStep * stepMs;
        const audioTime = this.wallMsToAudioTime(wallMs);
        if (audioTime > lookAheadUntil) break;
        if (audioTime >= nowAudio - 0.3) {
          this.scheduleOscillator(
            'countdown',
            Math.max(audioTime, nowAudio),
            duration,
          );
        }
        this.nextScheduledPrepStep++;
      }
    } else if (this.phase === 'running' && this.gridStartTime !== null) {
      const stepMs = scheduleStepSeconds(this.config) * 1000;
      const currentStep = Math.floor(
        (Date.now() - this.gridStartTime) / stepMs,
      );
      if (this.nextScheduledStep < currentStep - 1) {
        this.nextScheduledStep = Math.max(0, currentStep - 1);
      }
      let safety = 0;
      while (safety++ < 200) {
        const wallMs = this.gridStartTime + this.nextScheduledStep * stepMs;
        const audioTime = this.wallMsToAudioTime(wallMs);
        if (audioTime > lookAheadUntil) break;
        if (audioTime >= nowAudio - 0.3) {
          const kind = soundKindForStep(this.nextScheduledStep, this.config);
          this.scheduleOscillator(
            kind,
            Math.max(audioTime, nowAudio),
            soundDurationForStep(kind, this.config),
          );
        }
        this.nextScheduledStep++;
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
      const realElapsedMs = Date.now() - this.timerStartTime;
      if (realElapsedMs > this.elapsedMs) {
        this.updateElapsed(Date.now());
        this.emit();
      }
      this.calibrate();
      this.scheduleUpcoming();
    }
  }

  // --- 操作 ---------------------------------------------------------

  /** app.js: startTimer */
  async start(config: TimerConfig) {
    if (this.phase !== 'idle') return;
    this.config = normalizeConfig(config);

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
    this.prepBase = PREP_SECONDS;
    this.prepCountdown = PREP_SECONDS;
    this.prepGridStart = Date.now();
    this.timerStartTime = null;
    this.gridStartTime = null;
    this.countBase = 1;
    this.elapsedSeconds = 0;
    this.elapsedMs = 0;
    this.gridElapsedMs = 0;
    this.count = 0;
    this.nextScheduledPrepStep = 1; // 最初のカウントダウン音は1刻み後
    this.nextScheduledStep = 0;
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

    if (this.phase === 'prep' && this.prepGridStart !== null) {
      this.updatePrep(Date.now());

      if (this.prepCountdown <= 0) {
        // 準備終了 → メインフェーズ
        const prepMs = prepStepSeconds(this.config) * 1000;
        this.phase = 'running';
        this.elapsedSeconds = 0;
        this.elapsedMs = 0;
        this.gridElapsedMs = 0;
        this.count = 1;
        this.countBase = 1;
        this.timerStartTime = this.prepGridStart + this.prepBase * prepMs;
        this.gridStartTime = this.timerStartTime;

        this.calibrate();
        this.nextScheduledStep = 0;

        if (this.ctx && this.ctx.state === 'running') {
          const firstBeep = this.wallMsToAudioTime(this.timerStartTime);
          this.scheduleOscillator(
            'beep',
            Math.max(firstBeep, this.ctx.currentTime),
            soundDurationForStep('beep', this.config),
          );
          this.nextScheduledStep = 1; // 刻み0 はスケジュール済み
        }
      }
    } else if (this.phase === 'running') {
      this.updateElapsed(Date.now());
    }

    this.calibrate();
    this.scheduleUpcoming();
    this.emit();
  }

  /** app.js: timerUILoop */
  private uiLoop() {
    if (this.phase === 'idle') return;

    if (this.phase === 'prep') {
      this.updatePrep(Date.now());
    } else if (this.phase === 'running') {
      this.updateElapsed(Date.now());
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
    this.countBase = 1;
    this.elapsedSeconds = 0;
    this.elapsedMs = 0;
    this.gridElapsedMs = 0;
    this.prepBase = PREP_SECONDS;
    this.prepCountdown = PREP_SECONDS;
    this.prepGridStart = null;
    this.timerStartTime = null;
    this.gridStartTime = null;
    this.nextScheduledStep = 0;
    this.nextScheduledPrepStep = 0;
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
