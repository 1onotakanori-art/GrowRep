import { describe, expect, it } from 'vitest';
import {
  buildDailyParticipants,
  buildDailyZoneWeek,
  dailyRepsBounds,
  dailyTargetCdf,
  dailyTargetProbability,
  dailyTargetQuantile,
  dailyZoneDayFromHistory,
  dailyZoneDrawWeights,
  dailyZoneEdges,
  dailyZoneMass,
  dailyZonePastDateKeys,
  dailyZoneRepsRange,
  dailyZoneWeekStartKey,
  dateKeyDayOfWeek,
  formatDailyZoneShare,
  generateDailyMissionTarget,
  pickDailyZone,
  replayDailyZoneWeek,
  settleDailyZoneDay,
  DAILY_ZONE_COUNT,
  DAILY_ZONE_START_DATE_KEY,
  type DailyZoneDayInput,
} from '../daily-mission';

// 2026-11-09 は月曜（領域の初日）
const WEEK = [
  '2026-11-09',
  '2026-11-10',
  '2026-11-11',
  '2026-11-12',
  '2026-11-13',
  '2026-11-14',
  '2026-11-15',
];
const ALL = [0, 1, 2, 3, 4, 5, 6];
const normal = (dateKey: string, peak = 30): DailyZoneDayInput => ({
  dateKey,
  kind: 'normal',
  exerciseKey: 'free_1',
  peak,
});

describe('曜日と週の起点', () => {
  it('領域の初日は月曜', () => {
    expect(dateKeyDayOfWeek(DAILY_ZONE_START_DATE_KEY)).toBe(1);
  });
  it('月曜始まり（日曜は前の月曜の週に入る）', () => {
    expect(dailyZoneWeekStartKey('2026-11-15')).toBe('2026-11-09');
    expect(dailyZoneWeekStartKey('2026-11-09')).toBe('2026-11-09');
    expect(dailyZoneWeekStartKey('2026-11-16')).toBe('2026-11-16');
    expect(dailyZoneWeekStartKey('2027-01-01')).toBe('2026-12-28');
  });
  it('今日より前の今週の日付', () => {
    expect(dailyZonePastDateKeys('2026-11-09')).toEqual([]);
    expect(dailyZonePastDateKeys('2026-11-11')).toEqual(['2026-11-09', '2026-11-10']);
    expect(dailyZonePastDateKeys('2026-11-15')).toEqual(WEEK.slice(0, 6));
    expect(dailyZonePastDateKeys('2026-11-08')).toEqual([]);
  });
});

describe('領域の境目と面積', () => {
  it('左端〜ピークを3等分、ピーク〜右端を4等分', () => {
    for (const peak of [12, 30, 80, 210]) {
      const { min, max } = dailyRepsBounds(peak);
      const e = dailyZoneEdges(peak);
      expect(e).toHaveLength(DAILY_ZONE_COUNT + 1);
      expect(e[0]).toBe(min);
      expect(e[3]).toBeCloseTo(peak, 9);
      expect(e[7]).toBeCloseTo(max, 9);
      expect(e[1] - e[0]).toBeCloseTo(e[3] - e[2], 9);
      expect(e[4] - e[3]).toBeCloseTo(e[7] - e[6], 9);
    }
  });
  it('両端の領域ほど面積が小さい', () => {
    const m = ALL.map((z) => dailyZoneMass(z, 30));
    expect(m[0]).toBeLessThan(m[1]);
    expect(m[1]).toBeLessThan(m[2]);
    expect(m[6]).toBeLessThan(m[5]);
    expect(m[5]).toBeLessThan(m[4]);
    // 7つの合計は抽選範囲の面積
    const { min, max } = dailyRepsBounds(30);
    expect(m.reduce((s, v) => s + v, 0)).toBeCloseTo(
      dailyTargetCdf(max, 30) - dailyTargetCdf(min, 30),
      9,
    );
  });
  it('ピークが下限に張り付く小さい種目でも壊れない', () => {
    const e = dailyZoneEdges(5);
    expect(e[0]).toBe(5);
    expect(e[3]).toBe(5);
    const w = dailyZoneDrawWeights(ALL, 5);
    expect(w.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
    expect(w[0]).toBe(0);
  });
  it('累積分布の逆関数', () => {
    for (const u of [0.01, 0.3, 0.5, 0.9, 0.99]) {
      expect(dailyTargetCdf(dailyTargetQuantile(u, 30), 30)).toBeCloseTo(u, 9);
    }
  });
});

describe('今日の領域の抽選（面積に比例）', () => {
  it('同じユーザー×日付×残りなら毎回同じ', () => {
    expect(pickDailyZone('u1', '2026-11-10', ALL, 30)).toBe(
      pickDailyZone('u1', '2026-11-10', ALL, 30),
    );
  });
  it('出る頻度が面積の比になる', () => {
    const weights = dailyZoneDrawWeights(ALL, 30);
    const counts = new Array(7).fill(0);
    const N = 20000;
    for (let i = 0; i < N; i++) counts[pickDailyZone(`p${i}`, '2026-11-10', ALL, 30)!]++;
    counts.forEach((c, z) => expect(Math.abs(c / N - weights[z])).toBeLessThan(0.012));
  });
  it('残っている領域からしか出ない', () => {
    for (let i = 0; i < 200; i++) {
      expect([1, 4, 6]).toContain(pickDailyZone(`q${i}`, '2026-11-12', [1, 4, 6], 30));
    }
    expect(pickDailyZone('u1', '2026-11-12', [], 30)).toBeNull();
  });
});

describe('領域つきの目標回数と確率', () => {
  it('目標はその領域の回数範囲に収まる', () => {
    for (const peak of [8, 12, 30, 80, 210]) {
      for (let i = 0; i < 60; i++) {
        for (const zone of ALL) {
          const t = generateDailyMissionTarget(`u${i}`, '2026-11-10', 'free_1', peak, zone);
          const r = dailyZoneRepsRange(zone, peak);
          expect(t).toBeGreaterThanOrEqual(r.min);
          expect(t).toBeLessThanOrEqual(r.max);
        }
      }
    }
  });
  it('領域ごとに、出うる回数の確率を足すと1', () => {
    for (const peak of [12, 30, 80]) {
      const { min, max } = dailyRepsBounds(peak);
      for (const z of ALL) {
        let sum = 0;
        for (let t = min; t <= max; t++) sum += dailyTargetProbability(t, peak, z);
        expect(sum).toBeCloseTo(1, 9);
      }
    }
  });
  it('実際に引いた頻度と一致する', () => {
    const zone = 4;
    const counts = new Map<number, number>();
    const N = 6000;
    for (let i = 0; i < N; i++) {
      const t = generateDailyMissionTarget(`m${i}`, '2026-11-10', 'free_1', 30, zone);
      counts.set(t, (counts.get(t) || 0) + 1);
    }
    counts.forEach((c, t) => {
      expect(Math.abs(c / N - dailyTargetProbability(t, 30, zone))).toBeLessThan(0.03);
    });
  });
  it('領域を入れる前の日の目標は従来と同じ（週報の固定値）', () => {
    expect(generateDailyMissionTarget('abc', '2026-11-03', 'free_1780545539883', 30)).toBe(21);
    expect(
      generateDailyMissionTarget('QGTsx53W25Wd5scfpBiJ87Q6PoC2', '2026-11-02', 'free_1775234504740', 12),
    ).toBe(11);
  });
});

describe('1日の消化', () => {
  it('クリアなら引いた領域が消える', () => {
    expect(settleDailyZoneDay(ALL, 5, true)).toEqual({
      pool: [0, 1, 2, 3, 4, 6],
      removed: 5,
      removedBy: 'clear',
    });
  });
  it('未クリアなら引いた領域は残り、一番軽い領域が消える', () => {
    expect(settleDailyZoneDay([2, 3, 6], 6, false)).toEqual({
      pool: [3, 6],
      removed: 2,
      removedBy: 'skip',
    });
  });
  it('引いた領域自身が一番軽ければそれが消える', () => {
    expect(settleDailyZoneDay([2, 3, 6], 2, false).pool).toEqual([3, 6]);
  });
  it('記録の無い日（引いていない）も一番軽い領域が消える', () => {
    expect(settleDailyZoneDay([1, 4], null, false).removed).toBe(1);
  });
});

describe('週の消化をたどる', () => {
  it('毎日クリアすると、7日で7つの領域を1回ずつ引く', () => {
    for (let i = 0; i < 50; i++) {
      const uid = `w${i}`;
      // 目標より十分多い合計＝毎日クリア
      const totals: Record<string, Record<string, number>> = {};
      WEEK.forEach((d) => (totals[d] = { [uid]: 9999 }));
      const r = replayDailyZoneWeek(uid, WEEK.map((d) => normal(d)), totals);
      expect(r.days.map((d) => d.zone).sort()).toEqual(ALL);
      expect(r.days.every((d) => d.removedBy === 'clear')).toBe(true);
      expect(r.pool).toEqual([]);
    }
  });
  it('サボってもきつい領域は残り、毎日1つずつ消えて日曜に空になる', () => {
    for (let i = 0; i < 50; i++) {
      const uid = `s${i}`;
      const r = replayDailyZoneWeek(uid, WEEK.map((d) => normal(d)), {});
      // 一度もクリアしない → 軽い順に消える
      expect(r.days.map((d) => d.removed)).toEqual(ALL);
      expect(r.days.every((d) => d.removedBy === 'skip')).toBe(true);
      expect(r.pool).toEqual([]);
    }
  });
  it('その日の合計と目標でクリアを判定する', () => {
    const uid = 'judge';
    const first = replayDailyZoneWeek(uid, [normal(WEEK[0])], {});
    const target = first.days[0].target!;
    const just = replayDailyZoneWeek(uid, [normal(WEEK[0])], {
      [WEEK[0]]: { [uid]: target },
    });
    expect(just.days[0].cleared).toBe(true);
    expect(just.days[0].removed).toBe(just.days[0].zone);
    const short = replayDailyZoneWeek(uid, [normal(WEEK[0])], {
      [WEEK[0]]: { [uid]: target - 1 },
    });
    expect(short.days[0].cleared).toBe(false);
    expect(short.days[0].removed).toBe(0);
  });
  it('レイド日は抽選も消化もしない', () => {
    const r = replayDailyZoneWeek('u1', [{ dateKey: WEEK[0], kind: 'paused' }], {});
    expect(r.pool).toEqual(ALL);
    expect(r.days[0].removed).toBeNull();
  });
});

describe('buildDailyZoneWeek', () => {
  it('月曜は7つ全部から引く', () => {
    const w = buildDailyZoneWeek('u1', WEEK[0], [], {}, 30)!;
    expect(w.pool).toEqual(ALL);
    expect(w.zone).toBe(pickDailyZone('u1', WEEK[0], ALL, 30));
    expect(w.days.map((d) => d.weekday)).toEqual(['月', '火', '水', '木', '金', '土', '日']);
    expect(w.days.map((d) => d.status)).toEqual([
      'today', 'future', 'future', 'future', 'future', 'future', 'future',
    ]);
  });
  it('記録の無い日は未クリア扱い（一番軽い領域が消える）', () => {
    const w = buildDailyZoneWeek('u1', WEEK[2], [], {}, 30)!;
    expect(w.pool).toEqual([2, 3, 4, 5, 6]);
    expect(w.days[0].removed).toBe(0);
    expect(w.days[1].removed).toBe(1);
    expect(w.days[0].cleared).toBe(false);
    expect(w.days[2].status).toBe('today');
  });
  it('日曜は残り1つが確定', () => {
    const w = buildDailyZoneWeek('u1', WEEK[6], WEEK.slice(0, 6).map((d) => normal(d)), {}, 30)!;
    expect(w.pool).toEqual([6]);
    expect(w.zone).toBe(6);
    expect(w.weights).toEqual([1]);
  });
  it('領域を入れる前の週は null', () => {
    expect(buildDailyZoneWeek('u1', '2026-11-08', [], {}, 30)).toBeNull();
  });
});

describe('dailyZoneDayFromHistory', () => {
  it('記録の種類を見分ける', () => {
    expect(dailyZoneDayFromHistory('d', undefined).kind).toBe('missed');
    expect(dailyZoneDayFromHistory('d', { exerciseKey: 'x', raidDay: 2 }).kind).toBe('paused');
    expect(dailyZoneDayFromHistory('d', { exerciseKey: 'x', peak: 40, raidDay: null })).toEqual({
      dateKey: 'd',
      kind: 'normal',
      exerciseKey: 'x',
      peak: 40,
    });
    expect(dailyZoneDayFromHistory('d', { exerciseKey: 'x', peak: null }).peak).toBeNull();
  });
});

describe('表示ヘルパー', () => {
  it('抽選確率の書式', () => {
    expect(formatDailyZoneShare(0.234)).toBe('23%');
    expect(formatDailyZoneShare(0.004)).toBe('<1%');
    expect(formatDailyZoneShare(0)).toBe('0%');
  });
});

describe('buildDailyParticipants（領域）', () => {
  it('渡した領域で目標と確率を出す', () => {
    const list = buildDailyParticipants({
      usersMap: { a: { userName: 'A' }, b: { userName: 'B' } },
      dateKey: '2026-11-10',
      exerciseKey: 'free_1',
      totals: {},
      myUserId: 'a',
      peak: 30,
      zones: { a: 6, b: 0 },
    });
    const a = list.find((p) => p.userId === 'a')!;
    expect(a.zone).toBe(6);
    expect(a.target).toBe(generateDailyMissionTarget('a', '2026-11-10', 'free_1', 30, 6));
    expect(a.probability).toBe(dailyTargetProbability(a.target, 30, 6));
  });
});
