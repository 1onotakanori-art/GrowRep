import { describe, it, expect } from 'vitest';
import {
  RAID_END_DATE_KEY,
  RAID_GOAL_MAX,
  RAID_MAINTENANCE_DATE_KEYS,
  RAID_SCHEDULE,
  RAID_START_DATE_KEY,
  RAID_TOTAL_DAYS,
  WEEKLY_PAUSE_WEEK_KEYS,
  applyRaidGoalOverride,
  buildRaidProgress,
  getRaidDayConfig,
  isRaidMaintenanceDay,
  isWeeklyPausedWeekStart,
  raidContributionRatio,
  resolveRaidExerciseKey,
  sanitizeRaidExerciseOverrides,
  sanitizeRaidGoalOverrides,
} from '../raid-mode';
import { getDailyBoundariesJST } from '../daily-mission';
import { getWeekBoundaries } from '../time-jst';
import type { FreeExerciseMap } from '../types';

const EXERCISES: FreeExerciseMap = {
  free_003: { name: '懸垂(セット)', rule: '', icon: 'fa-dumbbell', tags: [] },
  free_001: { name: '腕立て伏せ', rule: '', icon: 'fa-dumbbell', tags: [] },
  free_002: { name: 'エアスクワット', rule: '', icon: 'fa-dumbbell', tags: [] },
  free_004: {
    name: '腕立てタイムアタック',
    rule: '',
    icon: 'fa-dumbbell',
    tags: [],
    barbarian: true,
  },
};

/**
 * 初日に「腕立てジャンプ」が選ばれてしまった実環境の再現。
 * 派生種目のキーが素の種目より先に並ぶのが事故の条件だった。
 */
const EXERCISES_WITH_VARIANT: FreeExerciseMap = {
  free_000: { name: '腕立てジャンプ', rule: '', icon: 'fa-dumbbell', tags: [] },
  free_001: { name: '腕立て伏せ', rule: '', icon: 'fa-dumbbell', tags: [] },
  free_002: { name: 'エアスクワット', rule: '', icon: 'fa-dumbbell', tags: [] },
};

describe('日程表', () => {
  it('初日は 腕立て1000回 で、開始日と一致する', () => {
    const day1 = RAID_SCHEDULE[0];
    expect(day1.dateKey).toBe(RAID_START_DATE_KEY);
    expect(day1.day).toBe(1);
    expect(day1.goal).toBe(1000);
    expect(day1.nameHints).toContain('腕立て');
  });

  it('最終日が RAID_END_DATE_KEY と一致する', () => {
    expect(RAID_SCHEDULE[RAID_SCHEDULE.length - 1].dateKey).toBe(
      RAID_END_DATE_KEY,
    );
    expect(RAID_TOTAL_DAYS).toBe(RAID_SCHEDULE.length);
  });

  it('日付が重複せず、1日ずつ連続していて、day が1始まりの連番', () => {
    const keys = RAID_SCHEDULE.map((d) => d.dateKey);
    expect(new Set(keys).size).toBe(keys.length);
    RAID_SCHEDULE.forEach((d, i) => {
      expect(d.day).toBe(i + 1);
      expect(d.goal).toBeGreaterThan(0);
      expect(d.nameHints.length).toBeGreaterThan(0);
      if (i > 0) {
        const prev = getDailyBoundariesJST(RAID_SCHEDULE[i - 1].dateKey).start;
        const cur = getDailyBoundariesJST(d.dateKey).start;
        expect(cur.getTime() - prev.getTime()).toBe(24 * 60 * 60 * 1000);
      }
    });
  });

  it('メンテナンス日はレイド開始日の前日で、レイド期間と重ならない', () => {
    const maint = RAID_MAINTENANCE_DATE_KEYS[RAID_MAINTENANCE_DATE_KEYS.length - 1];
    const diff =
      getDailyBoundariesJST(RAID_START_DATE_KEY).start.getTime() -
      getDailyBoundariesJST(maint).start.getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
    RAID_MAINTENANCE_DATE_KEYS.forEach((k) => {
      expect(getRaidDayConfig(k)).toBeNull();
    });
  });
});

describe('isRaidMaintenanceDay / getRaidDayConfig', () => {
  it('メンテ日だけ true', () => {
    expect(isRaidMaintenanceDay('2026-08-08')).toBe(true);
    expect(isRaidMaintenanceDay('2026-08-09')).toBe(false);
    expect(isRaidMaintenanceDay('2026-08-07')).toBe(false);
  });

  it('レイド期間外は null', () => {
    expect(getRaidDayConfig('2026-08-09')?.day).toBe(1);
    expect(getRaidDayConfig('2026-08-16')?.day).toBe(RAID_TOTAL_DAYS);
    expect(getRaidDayConfig('2026-08-17')).toBeNull();
    expect(getRaidDayConfig('2026-08-08')).toBeNull();
  });
});

describe('resolveRaidExerciseKey', () => {
  it('名前の部分一致で引き当てる', () => {
    expect(resolveRaidExerciseKey(RAID_SCHEDULE[0], EXERCISES)).toBe('free_001');
  });

  it('ヒントの優先順に見る（先頭のヒントが勝つ）', () => {
    const cfg = { ...RAID_SCHEDULE[0], nameHints: ['スクワット', '腕立て'] };
    expect(resolveRaidExerciseKey(cfg, EXERCISES)).toBe('free_002');
  });

  it('バーバリアン種目は対象外', () => {
    const only = { free_004: EXERCISES.free_004 };
    expect(resolveRaidExerciseKey(RAID_SCHEDULE[0], only)).toBeNull();
  });

  it('一致が無ければ null（その日は通常ミッションに戻す）', () => {
    expect(
      resolveRaidExerciseKey(
        { ...RAID_SCHEDULE[0], nameHints: ['存在しない種目'] },
        EXERCISES,
      ),
    ).toBeNull();
    expect(resolveRaidExerciseKey(RAID_SCHEDULE[0], {})).toBeNull();
  });

  it('派生種目より素の種目を選ぶ（腕立てジャンプ事故の再発防止）', () => {
    // free_000（腕立てジャンプ）のほうがキー順で先だが、名前が長いので負ける
    expect(resolveRaidExerciseKey(RAID_SCHEDULE[0], EXERCISES_WITH_VARIANT)).toBe(
      'free_001',
    );
  });

  it('部分一致が複数ある場合は名前が短いほうを優先する', () => {
    const map: FreeExerciseMap = {
      a_long: { name: 'スクワットジャンプ', rule: '', icon: '', tags: [] },
      b_short: { name: 'スクワット', rule: '', icon: '', tags: [] },
    };
    expect(resolveRaidExerciseKey(RAID_SCHEDULE[1], map)).toBe('b_short');
  });

  it('名前の長さが並んだらキー昇順（全端末で同じ種目にするため）', () => {
    const map: FreeExerciseMap = {
      zz: { name: 'スクワットA', rule: '', icon: '', tags: [] },
      aa: { name: 'スクワットB', rule: '', icon: '', tags: [] },
    };
    expect(resolveRaidExerciseKey(RAID_SCHEDULE[1], map)).toBe('aa');
  });

  it('管理画面での指定が名前ヒントより優先される', () => {
    expect(
      resolveRaidExerciseKey(RAID_SCHEDULE[0], EXERCISES_WITH_VARIANT, {
        '2026-08-09': 'free_000',
      }),
    ).toBe('free_000');
  });

  it('指定された種目が消えていたら名前ヒントに落ちる', () => {
    expect(
      resolveRaidExerciseKey(RAID_SCHEDULE[0], EXERCISES_WITH_VARIANT, {
        '2026-08-09': 'free_deleted',
      }),
    ).toBe('free_001');
  });

  it('指定された種目がバーバリアンなら使わない（合計で競えないため）', () => {
    expect(
      resolveRaidExerciseKey(RAID_SCHEDULE[0], EXERCISES, {
        '2026-08-09': 'free_004',
      }),
    ).toBe('free_001');
  });

  it('別の日の指定は巻き込まれない', () => {
    expect(
      resolveRaidExerciseKey(RAID_SCHEDULE[0], EXERCISES_WITH_VARIANT, {
        '2026-08-10': 'free_000',
      }),
    ).toBe('free_001');
  });

  it('キー順が違っても同じ種目に決まる（全端末で一致させるため）', () => {
    const reordered: FreeExerciseMap = {};
    Object.keys(EXERCISES)
      .reverse()
      .forEach((k) => {
        reordered[k] = EXERCISES[k];
      });
    expect(resolveRaidExerciseKey(RAID_SCHEDULE[0], reordered)).toBe(
      resolveRaidExerciseKey(RAID_SCHEDULE[0], EXERCISES),
    );
  });
});

describe('isWeeklyPausedWeekStart', () => {
  it('休止週の起点だけ true', () => {
    // 週の起点は日曜17:00 JST。2026-08-09(日) 17:00 JST の週を休止する
    const start = getWeekBoundaries(new Date('2026-08-12T03:00:00Z')).start;
    expect(isWeeklyPausedWeekStart(start)).toBe(true);
    const prev = getWeekBoundaries(new Date('2026-08-05T03:00:00Z')).start;
    expect(isWeeklyPausedWeekStart(prev)).toBe(false);
    const next = getWeekBoundaries(new Date('2026-08-19T03:00:00Z')).start;
    expect(isWeeklyPausedWeekStart(next)).toBe(false);
    expect(isWeeklyPausedWeekStart(null)).toBe(false);
  });

  it('休止週はレイド期間に収まっている', () => {
    WEEKLY_PAUSE_WEEK_KEYS.forEach((k) => {
      expect(getRaidDayConfig(k)).not.toBeNull();
    });
  });
});

describe('目標回数の上書き（管理画面）', () => {
  const day1 = RAID_SCHEDULE[0];

  it('日程表にある日の妥当な数値だけ通す', () => {
    expect(
      sanitizeRaidGoalOverrides({ '2026-08-09': 1200, '2026-08-10': 900 }),
    ).toEqual({ '2026-08-09': 1200, '2026-08-10': 900 });
  });

  it('日程表に無い日は捨てる（古い設定が残っても影響しない）', () => {
    expect(sanitizeRaidGoalOverrides({ '2026-09-01': 500 })).toEqual({});
  });

  it('数値でない・範囲外・0以下は捨てる', () => {
    expect(
      sanitizeRaidGoalOverrides({
        '2026-08-09': 'abc',
        '2026-08-10': 0,
        '2026-08-11': -5,
        '2026-08-12': RAID_GOAL_MAX + 1,
        '2026-08-13': NaN,
        '2026-08-14': null,
      }),
    ).toEqual({});
  });

  it('小数は丸める', () => {
    expect(sanitizeRaidGoalOverrides({ '2026-08-09': 1200.6 })).toEqual({
      '2026-08-09': 1201,
    });
  });

  it('goals がオブジェクトでなくても壊れない', () => {
    expect(sanitizeRaidGoalOverrides(null)).toEqual({});
    expect(sanitizeRaidGoalOverrides(undefined)).toEqual({});
    expect(sanitizeRaidGoalOverrides('nope')).toEqual({});
  });

  it('上書きがあればそれを使い、無ければ既定値のまま', () => {
    const overridden = applyRaidGoalOverride(day1, { '2026-08-09': 1234 });
    expect(overridden.goal).toBe(1234);
    expect(overridden.goalSource).toBe('override');

    const plain = applyRaidGoalOverride(day1, {});
    expect(plain.goal).toBe(day1.goal);
    expect(plain.goalSource).toBe('default');
    expect(applyRaidGoalOverride(day1, null).goal).toBe(day1.goal);
  });

  it('元の日程表を書き換えない（非破壊）', () => {
    const before = day1.goal;
    applyRaidGoalOverride(day1, { '2026-08-09': 9999 });
    expect(RAID_SCHEDULE[0].goal).toBe(before);
  });

  it('別の日の上書きは巻き込まれない', () => {
    const r = applyRaidGoalOverride(day1, { '2026-08-10': 5000 });
    expect(r.goal).toBe(day1.goal);
    expect(r.goalSource).toBe('default');
  });

  it('種目の指定は日程表にある日・文字列だけ通す', () => {
    expect(
      sanitizeRaidExerciseOverrides({
        '2026-08-09': 'free_001',
        '2026-09-01': 'free_002',
        '2026-08-10': '',
        '2026-08-11': 123,
        '2026-08-12': null,
      }),
    ).toEqual({ '2026-08-09': 'free_001' });
    expect(sanitizeRaidExerciseOverrides(null)).toEqual({});
    expect(sanitizeRaidExerciseOverrides('nope')).toEqual({});
  });
});

describe('buildRaidProgress', () => {
  const config = RAID_SCHEDULE[0]; // goal 1000
  const usersMap = {
    u1: { userName: 'あ', lastActiveDateKey: '2026-08-09' },
    u2: { userName: 'い', lastActiveDateKey: '2026-08-09' },
    u3: { userName: 'う', lastActiveDateKey: '2026-08-01' }, // 今日は未ログイン
    u4: { userName: 'え', lastActiveDateKey: '2026-08-01' }, // 未ログインだが投稿あり
  };

  const build = (totals: Record<string, number>) =>
    buildRaidProgress({
      usersMap,
      dateKey: '2026-08-09',
      totals,
      myUserId: 'u1',
      config,
    });

  it('合計・残り・％を出す', () => {
    const r = build({ u1: 100, u2: 300 });
    expect(r.totalValue).toBe(400);
    expect(r.goal).toBe(1000);
    expect(r.remaining).toBe(600);
    expect(r.percent).toBe(40);
    expect(r.cleared).toBe(false);
    expect(r.myValue).toBe(100);
    expect(r.day).toBe(1);
    expect(r.goalSource).toBe('default');
  });

  it('上書きされた目標で判定する', () => {
    const r = buildRaidProgress({
      usersMap,
      dateKey: '2026-08-09',
      totals: { u1: 100, u2: 300 },
      myUserId: 'u1',
      config: applyRaidGoalOverride(config, { '2026-08-09': 400 }),
    });
    expect(r.goal).toBe(400);
    expect(r.goalSource).toBe('override');
    expect(r.cleared).toBe(true);
    expect(r.percent).toBe(100);
  });

  it('目標に届いたら討伐完了、％と残りは飽和する', () => {
    const r = build({ u1: 600, u2: 600 });
    expect(r.cleared).toBe(true);
    expect(r.percent).toBe(100);
    expect(r.remaining).toBe(0);
  });

  it('並ぶのは今日ログインした人＋投稿した人だけ', () => {
    const r = build({ u4: 50 });
    const ids = r.contributors.map((c) => c.userId);
    expect(ids).toContain('u1');
    expect(ids).toContain('u2');
    expect(ids).toContain('u4');
    expect(ids).not.toContain('u3');
  });

  it('貢献の多い順に並び、share の合計が1になる', () => {
    const r = build({ u1: 100, u2: 300 });
    expect(r.contributors[0].userId).toBe('u2');
    expect(r.contributors[0].isMe).toBe(false);
    expect(r.contributors[1].userId).toBe('u1');
    const shareSum = r.contributors.reduce((s, c) => s + c.share, 0);
    expect(shareSum).toBeCloseTo(1, 10);
    expect(r.activeCount).toBe(2);
  });

  it('誰も投稿していなくても壊れない', () => {
    const r = build({});
    expect(r.totalValue).toBe(0);
    expect(r.percent).toBe(0);
    expect(r.activeCount).toBe(0);
    expect(r.contributors.every((c) => c.share === 0)).toBe(true);
  });
});

describe('raidContributionRatio', () => {
  it('最多貢献者を満杯にして正規化する', () => {
    expect(raidContributionRatio(50, 100)).toBe(0.5);
    expect(raidContributionRatio(100, 100)).toBe(1);
    expect(raidContributionRatio(150, 100)).toBe(1);
    expect(raidContributionRatio(10, 0)).toBe(0);
  });
});
