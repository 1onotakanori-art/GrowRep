import { describe, it, expect } from 'vitest';
import {
  getWeekBoundaries,
  isWeekdayJST,
  isRevealUnlockedJST,
  getActiveWeeklyKeys,
  isPredictionOpenJST,
  weekdayIndexJST,
  buildChampionDocMeta,
} from '../time-jst';

// JST の壁時計時刻から UTC の Date を作るヘルパー（JST = UTC+9）
const jst = (
  y: number,
  mo: number,
  d: number,
  h = 0,
  mi = 0,
): Date => new Date(Date.UTC(y, mo - 1, d, h - 9, mi));

describe('getWeekBoundaries（週は日曜17:00 JST起点）', () => {
  it('水曜昼は直前の日曜17:00が週開始', () => {
    // 2026-07-22(水) 13:00 JST
    const { start, end } = getWeekBoundaries(jst(2026, 7, 22, 13));
    // 2026-07-19(日) 17:00 JST = 08:00 UTC
    expect(start.toISOString()).toBe('2026-07-19T08:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 3600 * 1000);
  });

  it('日曜16:59 JST はまだ前の週', () => {
    const { start } = getWeekBoundaries(jst(2026, 7, 26, 16, 59));
    expect(start.toISOString()).toBe('2026-07-19T08:00:00.000Z');
  });

  it('日曜17:00 JST ちょうどで新しい週に切り替わる', () => {
    const { start } = getWeekBoundaries(jst(2026, 7, 26, 17, 0));
    expect(start.toISOString()).toBe('2026-07-26T08:00:00.000Z');
  });
});

describe('isWeekdayJST', () => {
  it('月〜金は true、土日は false', () => {
    expect(isWeekdayJST(jst(2026, 7, 20, 10))).toBe(true); // 月
    expect(isWeekdayJST(jst(2026, 7, 24, 10))).toBe(true); // 金
    expect(isWeekdayJST(jst(2026, 7, 25, 10))).toBe(false); // 土
    expect(isWeekdayJST(jst(2026, 7, 26, 10))).toBe(false); // 日
  });
});

describe('isRevealUnlockedJST（4種目目は水曜13:00解禁）', () => {
  it('月火は未解禁', () => {
    expect(isRevealUnlockedJST(jst(2026, 7, 20, 23))).toBe(false); // 月
    expect(isRevealUnlockedJST(jst(2026, 7, 21, 23))).toBe(false); // 火
  });
  it('水曜は13:00で解禁', () => {
    expect(isRevealUnlockedJST(jst(2026, 7, 22, 12, 59))).toBe(false);
    expect(isRevealUnlockedJST(jst(2026, 7, 22, 13, 0))).toBe(true);
  });
  it('木金土は解禁済み、日曜17:00以降は未解禁', () => {
    expect(isRevealUnlockedJST(jst(2026, 7, 23, 0))).toBe(true); // 木
    expect(isRevealUnlockedJST(jst(2026, 7, 26, 16))).toBe(true); // 日16時=前週の続き
    expect(isRevealUnlockedJST(jst(2026, 7, 26, 17))).toBe(false); // 日17時=新週
  });
});

describe('getActiveWeeklyKeys', () => {
  const four = ['a', 'b', 'c', 'd'];
  it('3種目以下は常に全件', () => {
    expect(getActiveWeeklyKeys(['a', 'b', 'c'], jst(2026, 7, 20, 10))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
  it('4種目は解禁前3件・解禁後4件', () => {
    expect(getActiveWeeklyKeys(four, jst(2026, 7, 22, 12))).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(getActiveWeeklyKeys(four, jst(2026, 7, 22, 13))).toEqual(four);
  });
});

describe('isPredictionOpenJST（日曜17:00〜火曜24:00）', () => {
  it('日曜17:00以降・月・火は受付中', () => {
    expect(isPredictionOpenJST(jst(2026, 7, 26, 17))).toBe(true);
    expect(isPredictionOpenJST(jst(2026, 7, 20, 10))).toBe(true); // 月
    expect(isPredictionOpenJST(jst(2026, 7, 21, 23, 59))).toBe(true); // 火
  });
  it('水曜以降と日曜16時台は締切', () => {
    expect(isPredictionOpenJST(jst(2026, 7, 22, 0, 1))).toBe(false); // 水
    expect(isPredictionOpenJST(jst(2026, 7, 26, 16))).toBe(false); // 日16時
  });
});

describe('weekdayIndexJST', () => {
  it('月=0..金=4、土日=-1', () => {
    expect(weekdayIndexJST(jst(2026, 7, 20, 10))).toBe(0);
    expect(weekdayIndexJST(jst(2026, 7, 24, 10))).toBe(4);
    expect(weekdayIndexJST(jst(2026, 7, 25, 10))).toBe(-1);
  });
});

describe('buildChampionDocMeta', () => {
  it('docId は YYYY_Wnn 形式（月曜基準の週番号）', () => {
    const weekStart = new Date('2026-07-19T08:00:00.000Z'); // 日17:00 JST
    const meta = buildChampionDocMeta(weekStart);
    expect(meta.docId).toMatch(/^2026_W\d{2}$/);
    expect(meta.year).toBe(2026);
    // 月曜 JST が正しく算出されているか
    expect(meta.monJST.getUTCDay()).toBe(1);
    expect(meta.friJST.getUTCDay()).toBe(5);
  });
});
