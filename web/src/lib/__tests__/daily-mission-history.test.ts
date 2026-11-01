import { describe, it, expect } from 'vitest';
import {
  DAILY_HISTORY_KEEP_DAYS,
  DAILY_REPS_FLOOR,
  buildDailyHistoryEntry,
  buildRaidHistoryEntry,
  isDailyHistoryUpToDate,
  resolveDailyPeak,
  staleDailyHistoryKeys,
} from '../daily-mission';

describe('buildDailyHistoryEntry', () => {
  it('過去最高からピークを入れる', () => {
    expect(buildDailyHistoryEntry('ex1', 40)).toEqual({
      exerciseKey: 'ex1',
      peak: resolveDailyPeak(40),
      bestValue: 40,
      raidDay: null,
      raidGoal: null,
    });
  });

  it('投稿が無い種目（過去最高 0）は既定ピークで記録する', () => {
    const e = buildDailyHistoryEntry('ex1', 0);
    expect(e.bestValue).toBe(0);
    expect(e.peak).toBe(resolveDailyPeak(0));
  });

  it('過去最高を引けなかった日は peak も null（後で引き直したときに上書きされる）', () => {
    expect(buildDailyHistoryEntry('ex1', null)).toMatchObject({
      peak: null,
      bestValue: null,
    });
  });

  it('小さい過去最高でも下限が効く', () => {
    expect(buildDailyHistoryEntry('ex1', 1).peak).toBe(DAILY_REPS_FLOOR);
  });
});

describe('buildRaidHistoryEntry', () => {
  it('レイド日は個人目標を使わないので peak / bestValue は null', () => {
    expect(buildRaidHistoryEntry('push', 1, 1000)).toEqual({
      exerciseKey: 'push',
      peak: null,
      bestValue: null,
      raidDay: 1,
      raidGoal: 1000,
    });
  });
});

describe('isDailyHistoryUpToDate', () => {
  const entry = buildDailyHistoryEntry('ex1', 40);

  it('history が無い・その日が無いときは書き込みが要る', () => {
    expect(isDailyHistoryUpToDate(undefined, '2026-11-02', entry)).toBe(false);
    expect(isDailyHistoryUpToDate({}, '2026-11-02', entry)).toBe(false);
    expect(
      isDailyHistoryUpToDate({ '2026-11-01': entry }, '2026-11-02', entry),
    ).toBe(false);
  });

  it('同じ内容なら書き込み不要', () => {
    expect(
      isDailyHistoryUpToDate({ '2026-11-02': { ...entry } }, '2026-11-02', entry),
    ).toBe(true);
  });

  it('管理画面が書いた rerolledFrom などは比較に影響しない', () => {
    const saved = {
      '2026-11-02': { ...entry, rerolledFrom: ['old'], rerolledAt: 'x' },
    };
    expect(isDailyHistoryUpToDate(saved, '2026-11-02', entry)).toBe(true);
  });

  it('引き直しで種目が変わっていれば書き込みが要る', () => {
    const saved = { '2026-11-02': buildDailyHistoryEntry('old', 40) };
    expect(isDailyHistoryUpToDate(saved, '2026-11-02', entry)).toBe(false);
  });

  it('引き直し直後（ピーク未集計）から集計済みになったら書き込みが要る', () => {
    const saved = {
      '2026-11-02': { exerciseKey: 'ex1', peak: null, bestValue: null },
    };
    expect(isDailyHistoryUpToDate(saved, '2026-11-02', entry)).toBe(false);
  });

  it('raidDay / raidGoal が欠けた古い形も null と同じに扱う', () => {
    const saved = {
      '2026-11-02': { exerciseKey: 'ex1', peak: entry.peak, bestValue: 40 },
    };
    expect(isDailyHistoryUpToDate(saved, '2026-11-02', entry)).toBe(true);
  });
});

describe('staleDailyHistoryKeys', () => {
  it(`${DAILY_HISTORY_KEEP_DAYS}日以上前の日だけを返す`, () => {
    const history = {
      '2026-05-05': {}, // 181日前
      '2026-05-06': {}, // ちょうど180日前
      '2026-05-07': {}, // 179日前
      '2026-11-01': {},
    };
    expect(staleDailyHistoryKeys(history, '2026-11-02')).toEqual([
      '2026-05-05',
      '2026-05-06',
    ]);
  });

  it('年またぎ・月末でもずれない', () => {
    expect(
      // 2027-01-03 の3日前 = 2026-12-31（ちょうど3日前は消す側）
      staleDailyHistoryKeys({ '2026-12-31': {}, '2027-01-01': {} }, '2027-01-03', 3),
    ).toEqual(['2026-12-31']);
  });

  it('日付キーの形でないキーは触らない', () => {
    expect(staleDailyHistoryKeys({ foo: {}, '2020-01-01': {} }, '2026-11-02')).toEqual([
      '2020-01-01',
    ]);
  });

  it('history が無ければ空', () => {
    expect(staleDailyHistoryKeys(undefined, '2026-11-02')).toEqual([]);
  });
});
