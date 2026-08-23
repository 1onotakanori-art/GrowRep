import { describe, it, expect } from 'vitest';
import {
  getModeExercises,
  isWeeklyPostLockedByDailyMission,
} from '../mode-exercises';
import type { DailyMissionState } from '../daily-mission';
import type { FreeExerciseMap, WeeklyChallenge } from '../types';

const exercises: FreeExerciseMap = {
  a: { name: '腕立て', rule: '', icon: '', tags: [] },
  b: { name: 'ディップス', rule: '', icon: '', tags: [] },
  c: { name: 'スクワット', rule: '', icon: '', tags: [] },
  d: { name: 'L-Sit', rule: '', icon: '', tags: [] },
};

const weekly: WeeklyChallenge = {
  weekStart: new Date('2025-08-17T08:00:00Z'),
  weekEnd: new Date('2025-08-24T08:00:00Z'),
  exercises: ['a', 'b', 'c', 'd'],
  selectionHistory: {},
  creatorSelectionHistory: {},
};

/** 月曜 12:00 JST（水曜13:00の解禁前） */
const MON = new Date('2025-08-18T03:00:00Z');
/** 木曜 12:00 JST（解禁後） */
const THU = new Date('2025-08-21T03:00:00Z');

function daily(over: Partial<DailyMissionState> = {}): DailyMissionState {
  return {
    dateKey: '2025-08-18',
    exerciseKey: 'a',
    target: 30,
    cleared: false,
    totalValue: 0,
    probability: 0.5,
    peak: 40,
    bestValue: 40,
    peakSource: 'post',
    participants: [],
    raid: null,
    maintenance: false,
    ...over,
  } as DailyMissionState;
}

describe('isWeeklyPostLockedByDailyMission', () => {
  it('未クリアならロックする', () => {
    expect(isWeeklyPostLockedByDailyMission(daily({ cleared: false }))).toBe(true);
  });
  it('クリア済みならロックしない', () => {
    expect(isWeeklyPostLockedByDailyMission(daily({ cleared: true }))).toBe(false);
  });
  it('ミッション未取得（null/undefined）ならロックしない', () => {
    expect(isWeeklyPostLockedByDailyMission(null)).toBe(false);
    expect(isWeeklyPostLockedByDailyMission(undefined)).toBe(false);
  });
  it('レイド前メンテナンス日はミッションが無いのでロックしない', () => {
    expect(
      isWeeklyPostLockedByDailyMission(daily({ cleared: false, maintenance: true })),
    ).toBe(false);
  });
});

describe('getModeExercises（週間チャレンジのロック）', () => {
  it('フリーモードはデイリー未クリアでもロックしない', () => {
    const list = getModeExercises('free', exercises, weekly, MON, daily());
    expect(list).toHaveLength(4);
    expect(list.every((e) => !e.locked)).toBe(true);
  });

  it('デイリークリア済み・解禁前は4種目目だけ reveal ロック', () => {
    const list = getModeExercises(
      'weekly', exercises, weekly, MON, daily({ cleared: true }),
    );
    expect(list.map((e) => e.lockReason)).toEqual([
      undefined, undefined, undefined, 'reveal',
    ]);
  });

  it('デイリー未クリアなら解禁済みの枠も daily ロック', () => {
    const list = getModeExercises(
      'weekly', exercises, weekly, THU, daily({ cleared: false }),
    );
    expect(list.every((e) => e.locked)).toBe(true);
    expect(list.map((e) => e.lockReason)).toEqual([
      'daily', 'daily', 'daily', 'daily',
    ]);
  });

  it('未解禁枠は種目名を伏せたいので reveal を daily より優先する', () => {
    const list = getModeExercises(
      'weekly', exercises, weekly, MON, daily({ cleared: false }),
    );
    expect(list.map((e) => e.lockReason)).toEqual([
      'daily', 'daily', 'daily', 'reveal',
    ]);
  });

  it('デイリー未取得なら従来どおり（reveal ロックのみ）', () => {
    const list = getModeExercises('weekly', exercises, weekly, THU, null);
    expect(list.every((e) => !e.locked)).toBe(true);
  });
});
