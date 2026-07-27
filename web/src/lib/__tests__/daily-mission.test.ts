import { describe, it, expect } from 'vitest';
import {
  DAILY_AXIS_MAX_TICKS,
  DAILY_REPS_DEFAULT_PEAK,
  DAILY_REPS_FLOOR,
  assignLabelLanes,
  buildDailyDistributionCurve,
  buildDailyParticipants,
  createSeededRandom,
  dailyAxisWindow,
  dailyLogCenter,
  dailyRepsBounds,
  dailyTargetCdf,
  dailyTargetPdf,
  dailyTargetProbability,
  formatDailyDateLabel,
  formatDailyProbability,
  generateDailyMissionTarget,
  getDailyBoundariesJST,
  getDailyDateKeyJST,
  getDailyMissionCandidates,
  guessExerciseUnit,
  hashStringToSeed,
  isDailyActiveUser,
  pickDailyMissionExercise,
  resolveDailyPeak,
  sumDailyTotals,
  truncateLabelName,
  usedLaneCount,
} from '../daily-mission';
import type { FreeExerciseMap } from '../types';

const PEAK = DAILY_REPS_DEFAULT_PEAK;

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

describe('resolveDailyPeak / dailyRepsBounds', () => {
  it('投稿がある種目は過去最高回数がそのままピーク', () => {
    // クリア判定はその日の合計なので、1回の最高記録をそのまま目安にできる
    expect(resolveDailyPeak(100)).toBe(100);
    expect(resolveDailyPeak(45)).toBe(45);
  });
  it('投稿が無い種目は既定の30回', () => {
    expect(resolveDailyPeak(0)).toBe(DAILY_REPS_DEFAULT_PEAK);
    expect(resolveDailyPeak(NaN)).toBe(DAILY_REPS_DEFAULT_PEAK);
    expect(resolveDailyPeak(-10)).toBe(DAILY_REPS_DEFAULT_PEAK);
  });
  it('極端に小さい記録でも下限を割らない', () => {
    expect(resolveDailyPeak(2)).toBe(DAILY_REPS_FLOOR);
  });
  it('上下限はピークに比例する（旧仕様の 8〜150 よりはっきり狭い）', () => {
    expect(dailyRepsBounds(PEAK)).toEqual({ min: 14, max: 60 });
    expect(dailyRepsBounds(100)).toEqual({ min: 45, max: 200 });
  });
});

describe('generateDailyMissionTarget', () => {
  it('同じユーザー×日付×種目なら安定（リロードで変わらない）', () => {
    const a = generateDailyMissionTarget('u1', '2026-07-26', 'b_push', PEAK);
    const b = generateDailyMissionTarget('u1', '2026-07-26', 'b_push', PEAK);
    expect(a).toBe(b);
  });

  it('ユーザーごとにバラバラ', () => {
    const values = Array.from({ length: 30 }, (_, i) =>
      generateDailyMissionTarget(`user${i}`, '2026-07-26', 'b_push', PEAK),
    );
    expect(new Set(values).size).toBeGreaterThan(10);
  });

  it('常に下限〜上限の整数', () => {
    const { min, max } = dailyRepsBounds(PEAK);
    for (let i = 0; i < 3000; i++) {
      const v = generateDailyMissionTarget(`u${i}`, '2026-07-26', 'b_push', PEAK);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
    }
  });

  it('ピークを指定しなければ既定の30基準', () => {
    expect(generateDailyMissionTarget('u1', '2026-07-26', 'b_push')).toBe(
      generateDailyMissionTarget('u1', '2026-07-26', 'b_push', PEAK),
    );
  });

  it('ピークが変われば目標もその周辺へ移動する', () => {
    const values = Array.from({ length: 500 }, (_, i) =>
      generateDailyMissionTarget(`user${i}`, '2026-07-26', 'b_push', 80),
    );
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    expect(mean).toBeGreaterThan(60);
    expect(mean).toBeLessThan(100);
  });

  const sample = (n: number, peak = PEAK) =>
    Array.from({ length: n }, (_, i) =>
      generateDailyMissionTarget(`user${i}`, '2026-07-26', 'b_push', peak),
    );

  it('ピーク付近が最頻', () => {
    const counts = new Map<number, number>();
    sample(20000).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    expect(Math.abs(top - PEAK)).toBeLessThanOrEqual(1);
  });

  it('右に裾を引く（平均 > 中央値。対数正規の形は保つ）', () => {
    const values = sample(20000).sort((a, b) => a - b);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    expect(mean).toBeGreaterThan(values[Math.floor(values.length / 2)]);
  });

  it('倍率で見ると大きい側の方が狭い（多い回数を引いたときの絶望を減らす）', () => {
    // x そのものでなく log（＝何倍か）で、しかも分布の中心を基準に比べる。
    // 対数正規は x で見ると上側の裾が長いのが正常なので、圧縮できているかは
    // 倍率でしか判定できない。
    const c = dailyLogCenter(PEAK);
    const values = sample(20000);
    const logDev = (vs: number[]) =>
      vs.reduce((s, v) => s + Math.abs(Math.log(v) - c), 0) / vs.length;
    expect(logDev(values.filter((v) => Math.log(v) > c))).toBeLessThan(
      logDev(values.filter((v) => Math.log(v) < c)),
    );
  });

  it('旧仕様（対数正規 σ0.45）より上振れが小さい', () => {
    const values = sample(20000).sort((a, b) => a - b);
    // 旧仕様は p95≈76 / p99≈103 / 最大 150 まで出た
    expect(values[Math.floor(values.length * 0.95)]).toBeLessThan(55);
    expect(values[Math.floor(values.length * 0.99)]).toBeLessThanOrEqual(60);
    expect(Math.max(...values)).toBeLessThanOrEqual(dailyRepsBounds(PEAK).max);
    // 「50回以上」は 1 割未満に収まる（旧仕様は 25%）
    expect(values.filter((v) => v >= 50).length / values.length).toBeLessThan(0.1);
  });
});

describe('dailyTargetProbability / formatDailyProbability', () => {
  it('全ての目標回数の確率を足すと1になる', () => {
    const { min, max } = dailyRepsBounds(PEAK);
    let sum = 0;
    for (let t = min; t <= max; t++) sum += dailyTargetProbability(t, PEAK);
    expect(sum).toBeCloseTo(1, 3);
  });
  it('ピークの回数が最も引きやすい', () => {
    const { min, max } = dailyRepsBounds(PEAK);
    for (let t = min; t <= max; t++) {
      if (t === PEAK) continue;
      expect(dailyTargetProbability(t, PEAK)).toBeLessThan(
        dailyTargetProbability(PEAK, PEAK),
      );
    }
  });
  it('同じ倍率なら上側の方が出にくい', () => {
    expect(dailyTargetProbability(Math.round(PEAK * 1.4), PEAK)).toBeLessThan(
      dailyTargetProbability(Math.round(PEAK / 1.4), PEAK),
    );
  });
  it('範囲外は端に丸め込まれた確率と同じ', () => {
    const { min, max } = dailyRepsBounds(PEAK);
    expect(dailyTargetProbability(min - 5, PEAK)).toBe(
      dailyTargetProbability(min, PEAK),
    );
    expect(dailyTargetProbability(max + 5, PEAK)).toBe(
      dailyTargetProbability(max, PEAK),
    );
  });
  it('実際の抽選頻度とおおよそ一致する', () => {
    const N = 20000;
    const counts = new Map<number, number>();
    for (let i = 0; i < N; i++) {
      const v = generateDailyMissionTarget(`user${i}`, '2026-07-26', 'b_push', PEAK);
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    [PEAK - 5, PEAK, PEAK + 5].forEach((t) => {
      const actual = (counts.get(t) || 0) / N;
      expect(Math.abs(actual - dailyTargetProbability(t, PEAK))).toBeLessThan(0.01);
    });
  });
  it('表示は小数1桁、極小は <0.1%', () => {
    expect(formatDailyProbability(0.0412)).toBe('4.1%');
    expect(formatDailyProbability(0.0004)).toBe('<0.1%');
    expect(formatDailyProbability(0)).toBe('0%');
  });
});

describe('dailyTargetCdf', () => {
  it('0から1へ単調に増える', () => {
    let prev = 0;
    for (let x = 1; x <= 120; x++) {
      const v = dailyTargetCdf(x, PEAK);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
    expect(dailyTargetCdf(1, PEAK)).toBeLessThan(0.001);
    expect(dailyTargetCdf(150, PEAK)).toBeGreaterThan(0.999);
  });
  it('log空間の中心より下の面積はσの比になる', () => {
    // σ下:σ上 = 0.34:0.26 なので下側は 0.34/0.60 ≒ 0.567
    expect(dailyTargetCdf(Math.exp(dailyLogCenter(PEAK)), PEAK)).toBeCloseTo(
      0.34 / 0.6,
      6,
    );
    // 最頻値（ピーク）は中心より少し左なので、そこまでの面積は半分弱
    const atPeak = dailyTargetCdf(PEAK, PEAK);
    expect(atPeak).toBeGreaterThan(0.4);
    expect(atPeak).toBeLessThan(0.5);
  });
  it('0以下は0', () => {
    expect(dailyTargetCdf(0, PEAK)).toBe(0);
    expect(dailyTargetCdf(-3, PEAK)).toBe(0);
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

describe('dailyTargetPdf / buildDailyDistributionCurve', () => {
  it('密度はピークで最大', () => {
    const atPeak = dailyTargetPdf(PEAK, PEAK);
    expect(atPeak).toBeGreaterThan(dailyTargetPdf(PEAK - 5, PEAK));
    expect(atPeak).toBeGreaterThan(dailyTargetPdf(PEAK + 5, PEAK));
  });
  it('同じ倍率なら上側の方が低い（裾が短い）', () => {
    expect(dailyTargetPdf(PEAK * 1.4, PEAK)).toBeLessThan(
      dailyTargetPdf(PEAK / 1.4, PEAK),
    );
  });
  it('0以下は0', () => {
    expect(dailyTargetPdf(0, PEAK)).toBe(0);
    expect(dailyTargetPdf(-5, PEAK)).toBe(0);
  });
  it('カーブの最大値は1に正規化される', () => {
    const curve = buildDailyDistributionCurve(10, 60, PEAK);
    const maxY = Math.max(...curve.map((p) => p.y));
    expect(maxY).toBeLessThanOrEqual(1.0000001);
    expect(maxY).toBeGreaterThan(0.99);
  });
  it('カーブの最大点はピーク付近', () => {
    const curve = buildDailyDistributionCurve(10, 60, PEAK, 240);
    const top = curve.reduce((a, b) => (b.y > a.y ? b : a));
    expect(Math.abs(top.x - PEAK)).toBeLessThan(2);
  });
  it('xMin から xMax まで昇順で steps+1 点', () => {
    const curve = buildDailyDistributionCurve(10, 100, PEAK, 50);
    expect(curve.length).toBe(51);
    expect(curve[0].x).toBe(10);
    expect(curve[curve.length - 1].x).toBeCloseTo(100);
    expect(curve.every((p, i) => i === 0 || p.x > curve[i - 1].x)).toBe(true);
  });
  it('yは常に有限で非負', () => {
    const curve = buildDailyDistributionCurve(0, 200, PEAK, 400);
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

describe('dailyAxisWindow', () => {
  const cases = [0, 30, 60, 105, 210, 500, 2000, 10000].map((best) =>
    resolveDailyPeak(best),
  );

  it('どのピークでも目盛りが多くなりすぎない', () => {
    cases.forEach((peak) => {
      const { min, max, step } = dailyAxisWindow(peak, peak); // 幅ゼロでも壊れない
      expect((max - min) / step + 1).toBeLessThanOrEqual(DAILY_AXIS_MAX_TICKS);
    });
    cases.forEach((peak) => {
      const b = dailyRepsBounds(peak);
      const { min, max, step } = dailyAxisWindow(b.min, b.max);
      const ticks = (max - min) / step + 1;
      expect(Number.isInteger(ticks)).toBe(true);
      expect(ticks).toBeGreaterThanOrEqual(3);
      expect(ticks).toBeLessThanOrEqual(DAILY_AXIS_MAX_TICKS);
    });
  });

  it('抽選範囲を内側に含み、両端に余白がある', () => {
    cases.forEach((peak) => {
      const b = dailyRepsBounds(peak);
      const { min, max } = dailyAxisWindow(b.min, b.max);
      expect(min).toBeLessThan(b.min);
      expect(max).toBeGreaterThan(b.max);
      expect(min).toBeGreaterThanOrEqual(0);
    });
  });

  it('ピークが大きくなるほど刻みも粗くなる', () => {
    const steps = cases.map((peak) => {
      const b = dailyRepsBounds(peak);
      return dailyAxisWindow(b.min, b.max).step;
    });
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
    }
    // ピーク30なら従来どおり10刻み
    expect(dailyAxisWindow(14, 60)).toEqual({ min: 10, max: 70, step: 10 });
  });

  it('目盛りは 0 未満にならない', () => {
    expect(dailyAxisWindow(2, 9).min).toBe(0);
  });
});

describe('isDailyActiveUser', () => {
  const DAY = '2026-07-26';
  it('今日ログインした人は載る', () => {
    expect(
      isDailyActiveUser({ lastActiveDateKey: DAY }, 'u2', DAY, {}, 'u1'),
    ).toBe(true);
  });
  it('昨日までしかログインしていない人は載らない', () => {
    expect(
      isDailyActiveUser({ lastActiveDateKey: '2026-07-25' }, 'u2', DAY, {}, 'u1'),
    ).toBe(false);
    expect(isDailyActiveUser({}, 'u2', DAY, {}, 'u1')).toBe(false);
    expect(isDailyActiveUser(undefined, 'u2', DAY, {}, 'u1')).toBe(false);
  });
  it('自分は記録が無くても必ず載る', () => {
    expect(isDailyActiveUser({}, 'u1', DAY, {}, 'u1')).toBe(true);
  });
  it('今日投稿している人は記録が無くても載る（記録漏れの保険）', () => {
    expect(isDailyActiveUser({}, 'u2', DAY, { u2: 5 }, 'u1')).toBe(true);
    expect(isDailyActiveUser({}, 'u2', DAY, { u2: 0 }, 'u1')).toBe(false);
  });
});

describe('buildDailyParticipants', () => {
  const DAY = '2026-07-26';
  const users = {
    u1: { userName: 'あきら', lastActiveDateKey: DAY },
    u2: { userName: 'ひろし', lastActiveDateKey: DAY },
    u3: { email: 'no-name@example.com', lastActiveDateKey: DAY },
    u4: { lastActiveDateKey: DAY },
  };
  const build = (
    totals: Record<string, number> = {},
    myUserId = 'u1',
    usersMap: Record<
      string,
      { userName?: string; email?: string; lastActiveDateKey?: string }
    > = users,
  ) =>
    buildDailyParticipants({
      usersMap,
      dateKey: DAY,
      exerciseKey: 'free_1',
      totals,
      myUserId,
      peak: PEAK,
    });

  it('今日ログインしたユーザー分を目標の昇順で返す', () => {
    const list = build();
    expect(list.length).toBe(4);
    for (let i = 1; i < list.length; i++) {
      expect(list[i].target).toBeGreaterThanOrEqual(list[i - 1].target);
    }
  });

  it('今日ログインしていないユーザーは並ばない', () => {
    const list = build({}, 'u1', {
      ...users,
      u5: { userName: 'ねぼすけ', lastActiveDateKey: '2026-07-20' },
      u6: { userName: 'みかけない' },
    });
    expect(list.map((p) => p.userId)).toEqual(['u1', 'u2', 'u3', 'u4'].sort(
      (a, b) =>
        generateDailyMissionTarget(a, DAY, 'free_1', PEAK) -
          generateDailyMissionTarget(b, DAY, 'free_1', PEAK) ||
        a.localeCompare(b),
    ));
  });

  it('目標は generateDailyMissionTarget と一致（保存不要で再現できる）', () => {
    build().forEach((p) => {
      expect(p.target).toBe(
        generateDailyMissionTarget(p.userId, DAY, 'free_1', PEAK),
      );
      expect(p.probability).toBe(dailyTargetProbability(p.target, PEAK));
    });
  });

  it('自分だけ isMe が立つ', () => {
    expect(build({}, 'u2').filter((p) => p.isMe).map((p) => p.userId)).toEqual([
      'u2',
    ]);
  });

  it('表示名は userName → email → 名無しさん の順', () => {
    const byId = Object.fromEntries(build().map((p) => [p.userId, p.userName]));
    expect(byId.u1).toBe('あきら');
    expect(byId.u3).toBe('no-name@example.com');
    expect(byId.u4).toBe('名無しさん');
  });

  it('当日の合計が目標以上ならクリア', () => {
    const t1 = generateDailyMissionTarget('u1', DAY, 'free_1', PEAK);
    const t2 = generateDailyMissionTarget('u2', DAY, 'free_1', PEAK);
    const byId = Object.fromEntries(
      build({ u1: t1, u2: t2 - 1 }).map((p) => [p.userId, p]),
    );
    expect(byId.u1.cleared).toBe(true); // ちょうど到達
    expect(byId.u2.cleared).toBe(false); // 1回足りない
    expect(byId.u4.cleared).toBe(false);
    expect(byId.u4.totalValue).toBe(0);
  });

  it('ユーザーが居なければ空', () => {
    expect(build({}, 'u1', {})).toEqual([]);
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
