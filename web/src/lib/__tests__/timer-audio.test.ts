import { describe, it, expect } from 'vitest';
import {
  BEEP_SOUND,
  BPM_MAX,
  BPM_MIN,
  COUNTDOWN_SOUND,
  DECAY_DIVISOR,
  DEFAULT_BPM,
  MASTER_VOLUME,
  PENDULUM_MAX_DEG,
  PREP_SECONDS,
  TICK_SOUND,
  INTERVAL_MAX,
  INTERVAL_MIN,
  beatInBar,
  beatPeriodSeconds,
  bpmBeepDuration,
  bpmCountdownDuration,
  clampBpm,
  clampIntervalSeconds,
  countStepSeconds,
  normalizeConfig,
  prepStepSeconds,
  scheduleStepSeconds,
  soundDurationForStep,
  soundKindForStep,
  type TimerConfig,
  countAtElapsed,
  countAtElapsedBpm,
  envelopeFor,
  formatElapsed,
  getComputedVolume,
  pendulumAngle,
  prepBeepSeconds,
  prepCountdownAt,
  soundKindForSecond,
  specFor,
} from '../timer-audio';

// app.js の定数を写経した「期待値の独立コピー」。
// どちらかを書き換えたらこのテストが落ちる＝仕様ズレの検知になる。
const APP_JS = {
  masterVolume: 1.0,
  tick: { volume: 1.0, frequency: 440, duration: 0.3 },
  beep: { volume: 1.0, frequency: 880, duration: 0.6 },
  countdown: { volume: 0.5, frequency: 660, duration: 0.3 },
  prepSeconds: 10,
  decayDivisor: 50,
};

describe('音の定数が app.js と一致する', () => {
  it('マスターボリューム', () => {
    expect(MASTER_VOLUME).toBe(APP_JS.masterVolume);
  });
  it('チック音 440Hz / 1.0 / 0.3秒', () => {
    expect(TICK_SOUND).toEqual(APP_JS.tick);
  });
  it('ビープ音 880Hz / 1.0 / 0.6秒', () => {
    expect(BEEP_SOUND).toEqual(APP_JS.beep);
  });
  it('カウントダウン音 660Hz / 0.5 / 0.3秒', () => {
    expect(COUNTDOWN_SOUND).toEqual(APP_JS.countdown);
  });
  it('準備時間は10秒', () => {
    expect(PREP_SECONDS).toBe(APP_JS.prepSeconds);
  });
  it('減衰は 1/50', () => {
    expect(DECAY_DIVISOR).toBe(APP_JS.decayDivisor);
  });
  it('specFor が種別ごとに正しいスペックを返す', () => {
    expect(specFor('tick')).toEqual(APP_JS.tick);
    expect(specFor('beep')).toEqual(APP_JS.beep);
    expect(specFor('countdown')).toEqual(APP_JS.countdown);
  });
});

describe('getComputedVolume', () => {
  it('マスター×個別', () => {
    expect(getComputedVolume(1.0)).toBe(1.0);
    expect(getComputedVolume(0.5)).toBe(0.5);
    expect(getComputedVolume(0.5, 0.5)).toBe(0.25);
  });
  it('0〜1にクランプ', () => {
    expect(getComputedVolume(2.0)).toBe(1);
    expect(getComputedVolume(-1)).toBe(0);
  });
});

describe('envelopeFor（app.js: scheduleOscillator の包絡）', () => {
  it('開始音量 = 複合音量、終端 = その1/50', () => {
    const beep = envelopeFor('beep');
    expect(beep.startVolume).toBeCloseTo(1.0);
    expect(beep.endVolume).toBeCloseTo(1.0 / 50);
    expect(beep.frequency).toBe(880);
    expect(beep.duration).toBe(0.6);

    const cd = envelopeFor('countdown');
    expect(cd.startVolume).toBeCloseTo(0.5);
    expect(cd.endVolume).toBeCloseTo(0.5 / 50);
  });
  it('exponentialRamp 用に 0 を避ける', () => {
    (['tick', 'beep', 'countdown'] as const).forEach((k) => {
      const e = envelopeFor(k);
      expect(e.startVolume).toBeGreaterThan(0);
      expect(e.endVolume).toBeGreaterThan(0);
    });
  });
});

describe('soundKindForSecond（鳴るタイミング）', () => {
  it('インターバル3秒: 0,3,6,9 がビープ、その他はチック', () => {
    const kinds = Array.from({ length: 10 }, (_, s) => soundKindForSecond(s, 3));
    expect(kinds).toEqual([
      'beep', 'tick', 'tick',
      'beep', 'tick', 'tick',
      'beep', 'tick', 'tick',
      'beep',
    ]);
  });
  it('インターバル1秒: 毎秒ビープ（チックは鳴らない）', () => {
    const kinds = Array.from({ length: 6 }, (_, s) => soundKindForSecond(s, 1));
    expect(kinds.every((k) => k === 'beep')).toBe(true);
  });
  it('インターバル5秒', () => {
    expect(soundKindForSecond(0, 5)).toBe('beep');
    expect(soundKindForSecond(4, 5)).toBe('tick');
    expect(soundKindForSecond(5, 5)).toBe('beep');
    expect(soundKindForSecond(10, 5)).toBe('beep');
  });
  it('開始直後（秒0）は必ずビープ', () => {
    for (let iv = 1; iv <= 60; iv++) {
      expect(soundKindForSecond(0, iv)).toBe('beep');
    }
  });
});

describe('prepBeepSeconds（準備フェーズ）', () => {
  it('1〜9秒の9回。0秒と10秒には鳴らない', () => {
    expect(prepBeepSeconds()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('prepCountdownAt', () => {
  it('10からカウントダウンし0で止まる', () => {
    expect(prepCountdownAt(0)).toBe(10);
    expect(prepCountdownAt(1)).toBe(9);
    expect(prepCountdownAt(9)).toBe(1);
    expect(prepCountdownAt(10)).toBe(0);
    expect(prepCountdownAt(15)).toBe(0);
  });
});

describe('countAtElapsed（回数表示）', () => {
  it('0秒時点で1', () => {
    expect(countAtElapsed(0, 3)).toBe(1);
  });
  it('インターバル3秒: 3秒ごとに増える', () => {
    const counts = Array.from({ length: 10 }, (_, s) => countAtElapsed(s, 3));
    expect(counts).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4]);
  });
  it('回数が増える秒はビープが鳴る秒と一致する', () => {
    for (const iv of [1, 2, 3, 5, 7]) {
      for (let s = 1; s < 60; s++) {
        const increased = countAtElapsed(s, iv) > countAtElapsed(s - 1, iv);
        expect(increased).toBe(soundKindForSecond(s, iv) === 'beep');
      }
    }
  });
});

describe('BPMモード', () => {
  it('clampBpm は 30〜300 に丸める', () => {
    expect(clampBpm(60)).toBe(60);
    expect(clampBpm(BPM_MIN - 10)).toBe(BPM_MIN);
    expect(clampBpm(BPM_MAX + 10)).toBe(BPM_MAX);
    expect(clampBpm(90.4)).toBe(90);
    expect(clampBpm(Number.NaN)).toBe(DEFAULT_BPM);
  });

  it('beatPeriodSeconds: 60BPM=1秒 / 120BPM=0.5秒', () => {
    expect(beatPeriodSeconds(60)).toBe(1);
    expect(beatPeriodSeconds(120)).toBe(0.5);
    expect(beatPeriodSeconds(30)).toBe(2);
  });

  it('countAtElapsedBpm: 開始時は1で、1拍ごとに1増える', () => {
    expect(countAtElapsedBpm(0, 120)).toBe(1);
    expect(countAtElapsedBpm(0.49, 120)).toBe(1);
    expect(countAtElapsedBpm(0.5, 120)).toBe(2);
    expect(countAtElapsedBpm(1.0, 120)).toBe(3);
    // 60BPM はインターバル1秒と同じ刻み
    for (let s = 0; s < 30; s++) {
      expect(countAtElapsedBpm(s, 60)).toBe(countAtElapsed(s, 1));
    }
  });

  it('bpmBeepDuration: 速いテンポでは1拍の半分まで短くする', () => {
    // 30BPM(1拍2秒) は通常のビープと同じ長さが上限
    expect(bpmBeepDuration(30)).toBe(BEEP_SOUND.duration);
    // 60BPM(1拍1秒) → 0.5秒、120BPM(1拍0.5秒) → 0.25秒
    expect(bpmBeepDuration(60)).toBeCloseTo(0.5);
    expect(bpmBeepDuration(120)).toBeCloseTo(0.25);
    // どのテンポでも音は1拍に収まる（重ならない）
    for (let bpm = BPM_MIN; bpm <= BPM_MAX; bpm += 7) {
      expect(bpmBeepDuration(bpm)).toBeLessThanOrEqual(beatPeriodSeconds(bpm));
      expect(bpmBeepDuration(bpm)).toBeGreaterThan(0);
    }
  });

  it('pendulumAngle: 拍の境界でちょうど左右の端に来る', () => {
    const bpm = 120; // 1拍 500ms
    expect(pendulumAngle(0, bpm)).toBeCloseTo(PENDULUM_MAX_DEG);
    expect(pendulumAngle(500, bpm)).toBeCloseTo(-PENDULUM_MAX_DEG);
    expect(pendulumAngle(1000, bpm)).toBeCloseTo(PENDULUM_MAX_DEG);
    // 拍の中間では中央（0度）を通過する
    expect(pendulumAngle(250, bpm)).toBeCloseTo(0);
    // 振れ角は常に範囲内
    for (let ms = 0; ms < 3000; ms += 37) {
      expect(Math.abs(pendulumAngle(ms, bpm))).toBeLessThanOrEqual(
        PENDULUM_MAX_DEG + 1e-9,
      );
    }
  });

  it('beatInBar: 4拍で一巡する', () => {
    const bpm = 60; // 1拍 1000ms
    expect(beatInBar(0, bpm)).toBe(0);
    expect(beatInBar(999, bpm)).toBe(0);
    expect(beatInBar(1000, bpm)).toBe(1);
    expect(beatInBar(3000, bpm)).toBe(3);
    expect(beatInBar(4000, bpm)).toBe(0);
  });
});

describe('モード共通のグリッド（刻み）', () => {
  const iv = (sec: number): TimerConfig => ({
    mode: 'interval',
    intervalSeconds: sec,
    bpm: 60,
  });
  const bp = (bpm: number): TimerConfig => ({
    mode: 'bpm',
    intervalSeconds: 3,
    bpm,
  });

  it('インターバル: 音は毎秒、回数はインターバル秒ごと', () => {
    expect(scheduleStepSeconds(iv(3))).toBe(1);
    expect(countStepSeconds(iv(3))).toBe(3);
  });

  it('BPM: 音も回数も1拍ごと', () => {
    expect(scheduleStepSeconds(bp(120))).toBe(0.5);
    expect(countStepSeconds(bp(120))).toBe(0.5);
  });

  it('準備の刻み: インターバルは1秒、BPMは1拍', () => {
    expect(prepStepSeconds(iv(3))).toBe(1);
    expect(prepStepSeconds(bp(120))).toBe(0.5);
    expect(prepStepSeconds(bp(30))).toBe(2);
  });

  it('準備フェーズ全体の長さ = 10刻み', () => {
    // インターバルモードは app.js と同じ10秒
    expect(PREP_SECONDS * prepStepSeconds(iv(3))).toBe(10);
    // 120BPM なら10拍 = 5秒
    expect(PREP_SECONDS * prepStepSeconds(bp(120))).toBe(5);
  });

  it('soundKindForStep: インターバルは従来どおり、BPMは常にビープ', () => {
    const kinds = Array.from({ length: 7 }, (_, s) => soundKindForStep(s, iv(3)));
    expect(kinds).toEqual([
      'beep', 'tick', 'tick', 'beep', 'tick', 'tick', 'beep',
    ]);
    for (let s = 0; s < 8; s++) {
      expect(soundKindForStep(s, bp(120))).toBe('beep');
    }
  });

  it('soundDurationForStep: インターバルは既定長、BPMは1拍の半分が上限', () => {
    expect(soundDurationForStep('beep', iv(3))).toBeUndefined();
    expect(soundDurationForStep('countdown', iv(3))).toBeUndefined();
    expect(soundDurationForStep('beep', bp(120))).toBe(bpmBeepDuration(120));
    expect(soundDurationForStep('countdown', bp(120))).toBe(
      bpmCountdownDuration(120),
    );
  });

  it('bpmCountdownDuration も1拍の半分に収まる', () => {
    expect(bpmCountdownDuration(60)).toBe(COUNTDOWN_SOUND.duration);
    expect(bpmCountdownDuration(240)).toBeCloseTo(0.125);
    for (let bpm = BPM_MIN; bpm <= BPM_MAX; bpm += 11) {
      expect(bpmCountdownDuration(bpm)).toBeLessThanOrEqual(
        beatPeriodSeconds(bpm),
      );
    }
  });

  it('clampIntervalSeconds / normalizeConfig が範囲外を丸める', () => {
    expect(clampIntervalSeconds(0)).toBe(INTERVAL_MIN);
    expect(clampIntervalSeconds(999)).toBe(INTERVAL_MAX);
    expect(clampIntervalSeconds(Number.NaN)).toBe(3);
    expect(
      normalizeConfig({ mode: 'bpm', intervalSeconds: 0, bpm: 1000 }),
    ).toEqual({ mode: 'bpm', intervalSeconds: INTERVAL_MIN, bpm: BPM_MAX });
  });
});

describe('formatElapsed', () => {
  it('M:SS 表記', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(9)).toBe('0:09');
    expect(formatElapsed(60)).toBe('1:00');
    expect(formatElapsed(125)).toBe('2:05');
    expect(formatElapsed(3599)).toBe('59:59');
    expect(formatElapsed(3600)).toBe('60:00');
  });
  it('小数は切り捨て', () => {
    expect(formatElapsed(59.9)).toBe('0:59');
  });
});
