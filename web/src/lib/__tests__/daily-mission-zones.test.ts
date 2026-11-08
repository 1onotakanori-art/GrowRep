import { describe, expect, it } from 'vitest';
import {
  buildDailyParticipants,
  buildDailyZoneWeek,
  dailyRepsBounds,
  dailyTargetCdf,
  dailyTargetProbability,
  dailyTargetQuantile,
  dailyZoneBoundaries,
  dailyZoneOrder,
  dailyZoneRepsRange,
  dailyZoneWeekStartKey,
  dateKeyDayOfWeek,
  generateDailyMissionTarget,
  getDailyZone,
  DAILY_ZONE_COUNT,
  DAILY_ZONE_START_DATE_KEY,
} from '../daily-mission';

// 2026-11-09 は月曜（領域の初日）
const WEEK = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'];
const USERS = Array.from({ length: 40 }, (_, i) => `user${i}`);

describe('曜日と週の起点', () => {
  it('領域の初日は月曜', () => {
    expect(dateKeyDayOfWeek(DAILY_ZONE_START_DATE_KEY)).toBe(1);
  });
  it('日曜は前の月曜の週に入る', () => {
    expect(dailyZoneWeekStartKey('2026-11-15')).toBe('2026-11-09');
    expect(dailyZoneWeekStartKey('2026-11-14')).toBe('2026-11-09');
    expect(dailyZoneWeekStartKey('2026-11-09')).toBe('2026-11-09');
    expect(dailyZoneWeekStartKey('2026-11-16')).toBe('2026-11-16');
    // 月またぎ・年またぎ
    expect(dailyZoneWeekStartKey('2027-01-01')).toBe('2026-12-28');
  });
});

describe('dailyZoneOrder / getDailyZone', () => {
  it('月〜金で5つの領域がちょうど1回ずつ出る', () => {
    for (const u of USERS) {
      const zones = WEEK.map((d) => getDailyZone(u, d));
      expect([...zones].sort()).toEqual([0, 1, 2, 3, 4]);
    }
  });
  it('同じユーザー×週なら毎回同じ並び', () => {
    expect(dailyZoneOrder('u1', '2026-11-09')).toEqual(
      dailyZoneOrder('u1', '2026-11-09'),
    );
  });
  it('並びはユーザーごと・週ごとにバラける', () => {
    const orders = new Set(USERS.map((u) => dailyZoneOrder(u, '2026-11-09').join()));
    expect(orders.size).toBeGreaterThan(20);
    const weeks = new Set(
      ['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'].map((w) =>
        dailyZoneOrder('u1', w).join(),
      ),
    );
    expect(weeks.size).toBeGreaterThan(1);
  });
  it('どの曜日にどの領域が来るかに偏りがない', () => {
    // 曜日×領域の出現回数（2000人）。一様なら各マス 400 前後
    const counts = Array.from({ length: 5 }, () => new Array(5).fill(0));
    for (let i = 0; i < 2000; i++) {
      dailyZoneOrder(`x${i}`, '2026-11-09').forEach((z, d) => counts[d][z]++);
    }
    counts.flat().forEach((c) => {
      expect(c).toBeGreaterThan(320);
      expect(c).toBeLessThan(480);
    });
  });
  it('土日と、領域を入れる前の日は null（全域から抽選）', () => {
    expect(getDailyZone('u1', '2026-11-14')).toBeNull();
    expect(getDailyZone('u1', '2026-11-15')).toBeNull();
    expect(getDailyZone('u1', '2026-11-06')).toBeNull();
    expect(getDailyZone('u1', '2026-11-08')).toBeNull();
  });
});

describe('dailyTargetQuantile / dailyZoneBoundaries', () => {
  it('累積分布の逆関数になっている', () => {
    for (const peak of [5, 12, 30, 80, 210]) {
      for (const u of [0.01, 0.2, 0.37, 0.5, 0.8, 0.99]) {
        expect(dailyTargetCdf(dailyTargetQuantile(u, peak), peak)).toBeCloseTo(u, 9);
      }
    }
  });
  it('境目は4本で昇順、ピークは中央付近の領域にある', () => {
    const b = dailyZoneBoundaries(30);
    expect(b).toHaveLength(DAILY_ZONE_COUNT - 1);
    for (let i = 1; i < b.length; i++) expect(b[i]).toBeGreaterThan(b[i - 1]);
    expect(b[1]).toBeLessThan(30);
    expect(b[3]).toBeGreaterThan(30);
  });
});

describe('領域つきの目標回数', () => {
  it('目標はその日の領域の回数範囲に収まる', () => {
    for (const peak of [5, 12, 30, 80, 210]) {
      for (const u of USERS) {
        for (const d of WEEK) {
          const zone = getDailyZone(u, d)!;
          const t = generateDailyMissionTarget(u, d, 'free_1', peak);
          const r = dailyZoneRepsRange(zone, peak);
          expect(t).toBeGreaterThanOrEqual(r.min);
          expect(t).toBeLessThanOrEqual(r.max);
        }
      }
    }
  });
  it('領域の範囲は軽い順に並び、全体で抽選範囲をちょうど覆う', () => {
    const peak = 30;
    const { min, max } = dailyRepsBounds(peak);
    const ranges = Array.from({ length: 5 }, (_, z) => dailyZoneRepsRange(z, peak));
    expect(ranges[0].min).toBe(min);
    expect(ranges[4].max).toBe(max);
    for (let z = 1; z < 5; z++) {
      // 境目の回数は両側の領域から出うる（隙間は無い）
      expect(ranges[z].min).toBeLessThanOrEqual(ranges[z - 1].max + 1);
      expect(ranges[z].min).toBeGreaterThanOrEqual(ranges[z - 1].min);
    }
  });
  it('領域を入れる前の日の目標は従来と同じ（週報の固定値）', () => {
    // analytics/daily-analytics.test.js の GOLDEN（2026-11-01 に作った値）
    expect(generateDailyMissionTarget('abc', '2026-11-03', 'free_1780545539883', 30)).toBe(21);
    expect(
      generateDailyMissionTarget('QGTsx53W25Wd5scfpBiJ87Q6PoC2', '2026-11-02', 'free_1775234504740', 12),
    ).toBe(11);
  });
});

describe('領域の中での確率', () => {
  it('領域ごとに、出うる回数の確率を足すと1', () => {
    for (const peak of [12, 30, 80]) {
      const { min, max } = dailyRepsBounds(peak);
      for (let z = 0; z < 5; z++) {
        let sum = 0;
        for (let t = min; t <= max; t++) sum += dailyTargetProbability(t, peak, z);
        expect(sum).toBeCloseTo(1, 9);
      }
    }
  });
  it('5領域の平均は全域の確率と一致する（週を通すと分布の形は変わらない）', () => {
    const peak = 30;
    const { min, max } = dailyRepsBounds(peak);
    for (let t = min; t <= max; t++) {
      let avg = 0;
      for (let z = 0; z < 5; z++) avg += dailyTargetProbability(t, peak, z) / 5;
      expect(avg).toBeCloseTo(dailyTargetProbability(t, peak), 9);
    }
  });
  it('実際に引いた頻度と一致する', () => {
    const peak = 30;
    const zone = 2;
    const counts = new Map<number, number>();
    let n = 0;
    for (let i = 0; i < 20000 && n < 4000; i++) {
      const u = `m${i}`;
      for (const d of WEEK) {
        if (getDailyZone(u, d) !== zone) continue;
        const t = generateDailyMissionTarget(u, d, 'free_1', peak);
        counts.set(t, (counts.get(t) || 0) + 1);
        n++;
      }
    }
    counts.forEach((c, t) => {
      expect(Math.abs(c / n - dailyTargetProbability(t, peak, zone))).toBeLessThan(0.03);
    });
  });
  it('領域の外の回数は 0', () => {
    const r = dailyZoneRepsRange(0, 30);
    expect(dailyTargetProbability(r.max + 3, 30, 0)).toBe(0);
  });
});

describe('buildDailyZoneWeek', () => {
  it('今日より前は past、今日は today、先は future', () => {
    const week = buildDailyZoneWeek('u1', '2026-11-11')!;
    expect(week.map((d) => d.weekday)).toEqual(['月', '火', '水', '木', '金']);
    expect(week.map((d) => d.status)).toEqual([
      'past',
      'past',
      'today',
      'future',
      'future',
    ]);
    expect(week[2].zone).toBe(getDailyZone('u1', '2026-11-11'));
  });
  it('土日は5日とも past', () => {
    const week = buildDailyZoneWeek('u1', '2026-11-15')!;
    expect(week.every((d) => d.status === 'past')).toBe(true);
    expect(week[0].dateKey).toBe('2026-11-09');
  });
  it('領域を入れる前の週は null', () => {
    expect(buildDailyZoneWeek('u1', '2026-11-08')).toBeNull();
  });
});

describe('buildDailyParticipants（領域）', () => {
  it('参加者ごとに今日の領域と、領域の中での確率が入る', () => {
    const list = buildDailyParticipants({
      usersMap: { a: { userName: 'A' }, b: { userName: 'B' } },
      dateKey: '2026-11-10',
      exerciseKey: 'free_1',
      totals: {},
      myUserId: 'a',
      peak: 30,
    });
    list.forEach((p) => {
      expect(p.zone).toBe(getDailyZone(p.userId, '2026-11-10'));
      expect(p.probability).toBe(dailyTargetProbability(p.target, 30, p.zone));
    });
  });
});
