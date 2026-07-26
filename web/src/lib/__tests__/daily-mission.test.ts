import { describe, it, expect } from 'vitest';
import {
  DAILY_REPS_MAX,
  DAILY_REPS_MIN,
  DAILY_REPS_PEAK,
  createSeededRandom,
  formatDailyDateLabel,
  generateDailyMissionTarget,
  getDailyBoundariesJST,
  getDailyDateKeyJST,
  getDailyMissionCandidates,
  guessExerciseUnit,
  hashStringToSeed,
  pickDailyMissionExercise,
} from '../daily-mission';
import type { FreeExerciseMap } from '../types';

const EX: FreeExerciseMap = {
  b_push: { name: 'プッシュアップ', rule: '', icon: 'fa-dumbbell', tags: [] },
  a_squat: { name: 'スクワット', rule: '', icon: 'fa-dumbbell', tags: [] },
  c_dips: { name: 'ディップス', rule: '', icon: 'fa-dumbbell', tags: [] },
  z_barb: {
    name: '100m走',
    rule: '',
    icon: 'fa-stopwatch',
    tags: [],
    barbarian: true,
  },
};

describe('getDailyDateKeyJST', () => {
  it('JST の暦日で区切る（UTC 15:00 = JST 翌日 0:00）', () => {
    expect(getDailyDateKeyJST(new Date('2026-07-25T14:59:59Z'))).toBe('2026-07-25');
    expect(getDailyDateKeyJST(new Date('2026-07-25T15:00:00Z'))).toBe('2026-07-26');
  });
});

describe('getDailyBoundariesJST', () => {
  it('JST 0:00〜24:00 に対応する UTC 範囲を返す', () => {
    const { start, end } = getDailyBoundariesJST('2026-07-26');
    expect(start.toISOString()).toBe('2026-07-25T15:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-26T15:00:00.000Z');
  });
  it('境界の日付キーと往復で一致する', () => {
    const { start, end } = getDailyBoundariesJST('2026-07-26');
    expect(getDailyDateKeyJST(start)).toBe('2026-07-26');
    expect(getDailyDateKeyJST(new Date(end.getTime() - 1))).toBe('2026-07-26');
    expect(getDailyDateKeyJST(end)).toBe('2026-07-27');
  });
});

describe('createSeededRandom / hashStringToSeed', () => {
  it('同じシードなら同じ列', () => {
    const a = createSeededRandom(hashStringToSeed('x'));
    const b = createSeededRandom(hashStringToSeed('x'));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('[0,1) に収まる', () => {
    const r = createSeededRandom(hashStringToSeed('seed'));
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('pickDailyMissionExercise', () => {
  it('バーバリアン種目は選ばれない', () => {
    for (let d = 1; d <= 60; d++) {
      const key = pickDailyMissionExercise(`2026-01-${String(d).padStart(2, '0')}`, EX);
      expect(key).not.toBe('z_barb');
    }
  });
  it('同じ日付・同じ種目セットなら全ユーザーで同じ結果', () => {
    const a = pickDailyMissionExercise('2026-07-26', EX);
    const b = pickDailyMissionExercise('2026-07-26', EX);
    expect(a).toBe(b);
    expect(a).not.toBeNull();
  });
  it('直近の種目は避ける', () => {
    const first = pickDailyMissionExercise('2026-07-26', EX)!;
    const second = pickDailyMissionExercise('2026-07-26', EX, [first]);
    expect(second).not.toBe(first);
  });
  it('全候補が直近に含まれる場合は候補全体から選ぶ', () => {
    const all = getDailyMissionCandidates(EX);
    const key = pickDailyMissionExercise('2026-07-26', EX, all);
    expect(all).toContain(key);
  });
  it('候補がなければ null', () => {
    expect(pickDailyMissionExercise('2026-07-26', {})).toBeNull();
    expect(
      pickDailyMissionExercise('2026-07-26', { z_barb: EX.z_barb }),
    ).toBeNull();
  });
  it('日付が変われば選出も分散する', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d++) {
      seen.add(pickDailyMissionExercise(`2026-02-${String(d).padStart(2, '0')}`, EX)!);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('generateDailyMissionTarget', () => {
  it('同じユーザー×日付×種目なら安定（リロードで変わらない）', () => {
    const a = generateDailyMissionTarget('u1', '2026-07-26', 'b_push');
    const b = generateDailyMissionTarget('u1', '2026-07-26', 'b_push');
    expect(a).toBe(b);
  });

  it('ユーザーごとにバラバラ', () => {
    const values = Array.from({ length: 30 }, (_, i) =>
      generateDailyMissionTarget(`user${i}`, '2026-07-26', 'b_push'),
    );
    expect(new Set(values).size).toBeGreaterThan(10);
  });

  it('常に下限〜上限の整数', () => {
    for (let i = 0; i < 3000; i++) {
      const v = generateDailyMissionTarget(`u${i}`, '2026-07-26', 'b_push');
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(DAILY_REPS_MIN);
      expect(v).toBeLessThanOrEqual(DAILY_REPS_MAX);
    }
  });

  it('30回付近をピークに右へ裾を引く（対数正規）', () => {
    const N = 20000;
    const values = Array.from({ length: N }, (_, i) =>
      generateDailyMissionTarget(`user${i}`, '2026-07-26', 'b_push'),
    );

    // 最頻ビン（5回刻み）が 30 を含むビンであること
    const bins = new Map<number, number>();
    values.forEach((v) => {
      const bin = Math.floor(v / 5) * 5;
      bins.set(bin, (bins.get(bin) || 0) + 1);
    });
    const topBin = [...bins.entries()].sort((a, b) => b[1] - a[1])[0][0];
    expect(topBin).toBe(Math.floor(DAILY_REPS_PEAK / 5) * 5);

    // 右に裾を引く: 平均 > 中央値
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(N / 2)];
    const mean = values.reduce((s, v) => s + v, 0) / N;
    expect(mean).toBeGreaterThan(median);

    // ピークを跨ぐ非対称性: 大きい側の方が広く分布する
    const below = values.filter((v) => v < DAILY_REPS_PEAK).length;
    const above = values.filter((v) => v > DAILY_REPS_PEAK * 2).length;
    expect(below).toBeGreaterThan(0);
    expect(above).toBeGreaterThan(0);
  });
});

describe('guessExerciseUnit', () => {
  it('種目名から単位を推測', () => {
    expect(guessExerciseUnit('Lシット(秒)')).toBe('秒');
    expect(guessExerciseUnit('懸垂(セット)')).toBe('セット');
    expect(guessExerciseUnit('プッシュアップ')).toBe('回');
  });
});

describe('formatDailyDateLabel', () => {
  it('M/D(曜) 形式', () => {
    expect(formatDailyDateLabel('2026-07-26')).toBe('7/26(日)');
  });
});
