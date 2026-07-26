import { describe, it, expect } from 'vitest';
import {
  BEEP_SOUND,
  COUNTDOWN_SOUND,
  DECAY_DIVISOR,
  MASTER_VOLUME,
  PREP_SECONDS,
  TICK_SOUND,
  countAtElapsed,
  envelopeFor,
  formatElapsed,
  getComputedVolume,
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
