import { describe, it, expect } from 'vitest';
import {
  DAILY_REPS_MAX,
  DAILY_REPS_MIN,
  DAILY_REPS_PEAK,
  assignLabelLanes,
  buildDailyDistributionCurve,
  buildDailyParticipants,
  createSeededRandom,
  dailyLogNormalPdf,
  formatDailyDateLabel,
  generateDailyMissionTarget,
  getDailyBoundariesJST,
  getDailyDateKeyJST,
  getDailyMissionCandidates,
  guessExerciseUnit,
  hashStringToSeed,
  pickDailyMissionExercise,
  sumDailyTotals,
  truncateLabelName,
  usedLaneCount,
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

describe('dailyLogNormalPdf / buildDailyDistributionCurve', () => {
  it('ピークは最頻値30回', () => {
    const at30 = dailyLogNormalPdf(DAILY_REPS_PEAK);
    expect(at30).toBeGreaterThan(dailyLogNormalPdf(DAILY_REPS_PEAK - 5));
    expect(at30).toBeGreaterThan(dailyLogNormalPdf(DAILY_REPS_PEAK + 5));
  });
  it('0以下は0', () => {
    expect(dailyLogNormalPdf(0)).toBe(0);
    expect(dailyLogNormalPdf(-5)).toBe(0);
  });
  it('カーブの最大値は1に正規化される', () => {
    const curve = buildDailyDistributionCurve(120);
    const maxY = Math.max(...curve.map((p) => p.y));
    expect(maxY).toBeLessThanOrEqual(1.0000001);
    expect(maxY).toBeGreaterThan(0.99);
  });
  it('カーブの最大点は30付近', () => {
    const curve = buildDailyDistributionCurve(120, 240);
    const top = curve.reduce((a, b) => (b.y > a.y ? b : a));
    expect(Math.abs(top.x - DAILY_REPS_PEAK)).toBeLessThan(2);
  });
  it('x=0 から xMax まで昇順で steps+1 点', () => {
    const curve = buildDailyDistributionCurve(100, 50);
    expect(curve.length).toBe(51);
    expect(curve[0].x).toBe(0);
    expect(curve[curve.length - 1].x).toBeCloseTo(100);
    expect(curve.every((p, i) => i === 0 || p.x > curve[i - 1].x)).toBe(true);
  });
  it('yは常に有限で非負', () => {
    const curve = buildDailyDistributionCurve(200, 400);
    expect(curve.every((p) => Number.isFinite(p.y) && p.y >= 0)).toBe(true);
  });
});

describe('sumDailyTotals（その日の合計で判定する）', () => {
  const posts = [
    { userId: 'u1', exerciseType: 'free_1', value: 12 },
    { userId: 'u1', exerciseType: 'free_1', value: 8 },
    { userId: 'u1', exerciseType: 'free_1', value: 5 },
    { userId: 'u2', exerciseType: 'free_1', value: 30 },
    { userId: 'u1', exerciseType: 'free_OTHER', value: 100 }, // 別種目
  ];

  it('同じユーザーの複数投稿を足し上げる（最大値ではない）', () => {
    const totals = sumDailyTotals(posts, 'free_1');
    expect(totals.u1).toBe(25); // 12+8+5。最大値の 12 ではない
    expect(totals.u2).toBe(30);
  });

  it('別種目の投稿は数えない', () => {
    expect(sumDailyTotals(posts, 'free_1').u1).toBe(25);
    expect(sumDailyTotals(posts, 'free_OTHER').u1).toBe(100);
  });

  it('投稿が無いユーザーはキーごと存在しない', () => {
    expect(sumDailyTotals(posts, 'free_1').u3).toBeUndefined();
  });

  it('0以下・不正な値は無視する', () => {
    const totals = sumDailyTotals(
      [
        { userId: 'u1', exerciseType: 'free_1', value: 10 },
        { userId: 'u1', exerciseType: 'free_1', value: 0 },
        { userId: 'u1', exerciseType: 'free_1', value: -5 },
        { userId: 'u1', exerciseType: 'free_1', value: NaN },
      ],
      'free_1',
    );
    expect(totals.u1).toBe(10);
  });

  it('空配列でも壊れない', () => {
    expect(sumDailyTotals([], 'free_1')).toEqual({});
  });

  it('1回では届かなくても積み上げれば達成できる', () => {
    const target = 30;
    const totals = sumDailyTotals(
      [
        { userId: 'u1', exerciseType: 'free_1', value: 10 },
        { userId: 'u1', exerciseType: 'free_1', value: 10 },
        { userId: 'u1', exerciseType: 'free_1', value: 10 },
      ],
      'free_1',
    );
    expect(totals.u1).toBeGreaterThanOrEqual(target);
  });
});

describe('buildDailyParticipants', () => {
  const users = {
    u1: { userName: 'あきら' },
    u2: { userName: 'ひろし' },
    u3: { email: 'no-name@example.com' },
    u4: {},
  };

  it('全ユーザー分を目標の昇順で返す', () => {
    const list = buildDailyParticipants(users, '2026-07-26', 'free_1', {}, 'u1');
    expect(list.length).toBe(4);
    for (let i = 1; i < list.length; i++) {
      expect(list[i].target).toBeGreaterThanOrEqual(list[i - 1].target);
    }
  });

  it('目標は generateDailyMissionTarget と一致（保存不要で再現できる）', () => {
    const list = buildDailyParticipants(users, '2026-07-26', 'free_1', {}, 'u1');
    list.forEach((p) => {
      expect(p.target).toBe(
        generateDailyMissionTarget(p.userId, '2026-07-26', 'free_1'),
      );
    });
  });

  it('自分だけ isMe が立つ', () => {
    const list = buildDailyParticipants(users, '2026-07-26', 'free_1', {}, 'u2');
    expect(list.filter((p) => p.isMe).map((p) => p.userId)).toEqual(['u2']);
  });

  it('表示名は userName → email → 名無しさん の順', () => {
    const byId = Object.fromEntries(
      buildDailyParticipants(users, '2026-07-26', 'free_1', {}, 'u1').map((p) => [
        p.userId,
        p.userName,
      ]),
    );
    expect(byId.u1).toBe('あきら');
    expect(byId.u3).toBe('no-name@example.com');
    expect(byId.u4).toBe('名無しさん');
  });

  it('当日の合計が目標以上ならクリア', () => {
    const t1 = generateDailyMissionTarget('u1', '2026-07-26', 'free_1');
    const t2 = generateDailyMissionTarget('u2', '2026-07-26', 'free_1');
    const list = buildDailyParticipants(
      users,
      '2026-07-26',
      'free_1',
      { u1: t1, u2: t2 - 1 },
      'u1',
    );
    const byId = Object.fromEntries(list.map((p) => [p.userId, p]));
    expect(byId.u1.cleared).toBe(true); // ちょうど到達
    expect(byId.u2.cleared).toBe(false); // 1回足りない
    expect(byId.u4.cleared).toBe(false);
    expect(byId.u4.totalValue).toBe(0);
  });

  it('ユーザーが居なければ空', () => {
    expect(buildDailyParticipants({}, '2026-07-26', 'free_1', {}, 'u1')).toEqual(
      [],
    );
  });
});

describe('truncateLabelName', () => {
  it('6文字まではそのまま', () => {
    expect(truncateLabelName('たなか')).toBe('たなか');
    expect(truncateLabelName('あいうえおか')).toBe('あいうえおか');
  });
  it('7文字以上は省略', () => {
    expect(truncateLabelName('あいうえおかき')).toBe('あいうえおか…');
    expect(truncateLabelName('Christopher')).toBe('Christ…');
  });
  it('空文字でも壊れない', () => {
    expect(truncateLabelName('')).toBe('');
  });
});

describe('assignLabelLanes', () => {
  /** 同じ段のラベル同士が重なっていないか検証するヘルパー */
  function noOverlap(xs: number[], widths: number[], lanes: number[]): boolean {
    for (let i = 0; i < xs.length; i++) {
      for (let j = i + 1; j < xs.length; j++) {
        if (lanes[i] !== lanes[j]) continue;
        const gap =
          Math.abs(xs[i] - xs[j]) - (widths[i] / 2 + widths[j] / 2);
        if (gap < 0) return false;
      }
    }
    return true;
  }

  it('十分離れていれば全て同じ段', () => {
    expect(assignLabelLanes([0, 100, 200], [40, 40, 40])).toEqual([0, 0, 0]);
  });

  it('近接するものは別の段へ', () => {
    const lanes = assignLabelLanes([0, 10, 20], [50, 50, 50]);
    expect(new Set(lanes).size).toBe(3);
  });

  it('段を増やせる限り必ず重ならない', () => {
    const xs = [0, 5, 12, 60, 63, 120, 121, 200, 201, 202];
    const widths = xs.map((_, i) => 40 + (i % 3) * 20);
    const lanes = assignLabelLanes(xs, widths);
    expect(noOverlap(xs, widths, lanes)).toBe(true);
  });

  it('同じ位置に重なっていても全て別の段になる', () => {
    const xs = [50, 50, 50, 50];
    const widths = [40, 40, 40, 40];
    const lanes = assignLabelLanes(xs, widths);
    expect(new Set(lanes).size).toBe(4);
    expect(noOverlap(xs, widths, lanes)).toBe(true);
  });

  it('幅が広いラベルは同じ段に同居できない', () => {
    // 中心が60離れていても、幅100同士なら重なる
    const lanes = assignLabelLanes([0, 60], [100, 100]);
    expect(lanes[0]).not.toBe(lanes[1]);
  });

  it('段の上限を超えない', () => {
    const xs = Array.from({ length: 20 }, (_, i) => i);
    const lanes = assignLabelLanes(xs, xs.map(() => 100), 3);
    expect(lanes.every((l) => l >= 0 && l < 3)).toBe(true);
  });

  it('入力順に対応した配列を返す', () => {
    const lanes = assignLabelLanes([200, 0, 100], [50, 50, 50]);
    expect(lanes.length).toBe(3);
    // 位置がバラバラでも全て同じ段に収まる（十分離れているため）
    expect(lanes).toEqual([0, 0, 0]);
  });

  it('空配列は空', () => {
    expect(assignLabelLanes([], [])).toEqual([]);
  });
});

describe('usedLaneCount', () => {
  it('最大段番号+1', () => {
    expect(usedLaneCount([0, 0, 1, 2])).toBe(3);
    expect(usedLaneCount([0])).toBe(1);
  });
  it('空なら0', () => {
    expect(usedLaneCount([])).toBe(0);
  });
});
