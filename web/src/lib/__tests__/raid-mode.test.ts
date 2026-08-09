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
  RAID_INPUT_GATE_FROM_DATE_KEY,
  RAID_POINTS_PER_DAY,
  RAID_TAG,
  bucketRaidTotals,
  buildRaidDayResult,
  buildRaidStandings,
  formatRaidPoints,
  getRaidInputOpenAt,
  hasRaidTag,
  isPerPersonRaidDay,
  isRaidInputGatedDay,
  isRaidInputOpen,
  countActiveUsersSince,
  getPreviousDateKey,
  raidConfiguredValue,
  resolveRaidGoal,
  resolveRaidMemberCount,
  sanitizeRaidMemberCounts,
  raidContributionRatio,
  resolveRaidExercise,
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
  it('初日だけ固定1000回（開催済みなので人数割にしない）', () => {
    const day1 = RAID_SCHEDULE[0];
    expect(day1.dateKey).toBe(RAID_START_DATE_KEY);
    expect(day1.day).toBe(1);
    expect(day1.goal).toBe(1000);
    expect(day1.perPerson).toBeUndefined();
    expect(isPerPersonRaidDay(day1)).toBe(false);
    expect(day1.nameHints).toContain('腕立て');
  });

  it('2日目以降はすべて人数割（1人あたりを持つ）', () => {
    RAID_SCHEDULE.slice(1).forEach((d) => {
      expect(isPerPersonRaidDay(d)).toBe(true);
      expect(d.perPerson).toBeGreaterThan(0);
      expect(d.goal).toBeUndefined();
    });
  });

  it('2日目はスクワット 200回/人', () => {
    const day2 = RAID_SCHEDULE[1];
    expect(day2.dateKey).toBe('2026-08-10');
    expect(day2.perPerson).toBe(200);
    expect(day2.nameHints).toContain('スクワット');
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
      expect(raidConfiguredValue(d)).toBeGreaterThan(0);
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

describe('「レイド」タグ', () => {
  /** 派生種目のほうにタグを付けた状態（タグが名前の推測に勝つか） */
  const TAGGED_VARIANT: FreeExerciseMap = {
    free_000: {
      name: '腕立てジャンプ',
      rule: '',
      icon: '',
      tags: [RAID_TAG],
    },
    free_001: { name: '腕立て伏せ', rule: '', icon: '', tags: [] },
  };

  it('タグの付いた種目が名前の推測より優先される', () => {
    const r = resolveRaidExercise(RAID_SCHEDULE[0], TAGGED_VARIANT);
    expect(r.key).toBe('free_000');
    expect(r.source).toBe('tag');
  });

  it('タグ付きが1つも無ければ名前で引く（従来どおり）', () => {
    const r = resolveRaidExercise(RAID_SCHEDULE[0], EXERCISES_WITH_VARIANT);
    expect(r.key).toBe('free_001');
    expect(r.source).toBe('name');
  });

  it('タグ付きがあってもその日のヒントに合わなければ名前で引く', () => {
    // スクワットの日。タグは腕立てにしか付いていない
    const r = resolveRaidExercise(RAID_SCHEDULE[1], {
      ...TAGGED_VARIANT,
      free_002: { name: 'エアスクワット', rule: '', icon: '', tags: [] },
    });
    expect(r.key).toBe('free_002');
    expect(r.source).toBe('name');
  });

  it('タグ付きが複数あっても名前が短いほうを選ぶ', () => {
    const r = resolveRaidExercise(RAID_SCHEDULE[0], {
      free_000: { name: '腕立てジャンプ', rule: '', icon: '', tags: [RAID_TAG] },
      free_001: { name: '腕立て伏せ', rule: '', icon: '', tags: [RAID_TAG] },
    });
    expect(r.key).toBe('free_001');
    expect(r.source).toBe('tag');
  });

  it('タグが付いていてもバーバリアン種目は使わない', () => {
    const r = resolveRaidExercise(RAID_SCHEDULE[0], {
      free_000: {
        name: '腕立てタイムアタック',
        rule: '',
        icon: '',
        tags: [RAID_TAG],
        barbarian: true,
      },
      free_001: { name: '腕立て伏せ', rule: '', icon: '', tags: [] },
    });
    expect(r.key).toBe('free_001');
    expect(r.source).toBe('name');
  });

  it('管理画面での指定はタグより優先される', () => {
    const r = resolveRaidExercise(RAID_SCHEDULE[0], TAGGED_VARIANT, {
      '2026-08-09': 'free_001',
    });
    expect(r.key).toBe('free_001');
    expect(r.source).toBe('pinned');
  });

  it('該当が無ければ key も source も null', () => {
    const r = resolveRaidExercise(RAID_SCHEDULE[0], {});
    expect(r.key).toBeNull();
    expect(r.source).toBeNull();
  });

  it('hasRaidTag は tags が無い/配列でない種目でも壊れない', () => {
    expect(hasRaidTag(TAGGED_VARIANT, 'free_000')).toBe(true);
    expect(hasRaidTag(TAGGED_VARIANT, 'free_001')).toBe(false);
    expect(hasRaidTag(TAGGED_VARIANT, 'missing')).toBe(false);
    expect(
      hasRaidTag(
        { x: { name: 'a', rule: '', icon: '' } as never },
        'x',
      ),
    ).toBe(false);
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

describe('0時発表 → 7時入力開始', () => {
  it('初日はゲート対象外（走り出しているので途中で止めない）', () => {
    expect(isRaidInputGatedDay('2026-08-09')).toBe(false);
    expect(isRaidInputGatedDay(RAID_INPUT_GATE_FROM_DATE_KEY)).toBe(true);
    expect(isRaidInputGatedDay('2026-08-16')).toBe(true);
  });

  it('入力開始は JST 7:00（= UTC 22:00 前日）', () => {
    expect(getRaidInputOpenAt('2026-08-10').toISOString()).toBe(
      '2026-08-09T22:00:00.000Z',
    );
  });

  it('初日は時刻によらず常に入力できる', () => {
    expect(isRaidInputOpen('2026-08-09', new Date('2026-08-08T15:00:00Z'))).toBe(
      true,
    );
  });

  it('ゲート対象日は7:00をまたぐと開く', () => {
    // JST 6:59:59（= UTC 21:59:59 前日）
    expect(
      isRaidInputOpen('2026-08-10', new Date('2026-08-09T21:59:59Z')),
    ).toBe(false);
    // JST 7:00:00 ちょうど
    expect(
      isRaidInputOpen('2026-08-10', new Date('2026-08-09T22:00:00Z')),
    ).toBe(true);
    // JST 12:00
    expect(
      isRaidInputOpen('2026-08-10', new Date('2026-08-10T03:00:00Z')),
    ).toBe(true);
  });
});

describe('積み上げ得点', () => {
  const USERS = {
    u1: { userName: 'あ' },
    u2: { userName: 'い' },
    u3: { userName: 'う' },
  };
  const day1 = RAID_SCHEDULE[0]; // 2026-08-09 / goal 1000
  const day2 = RAID_SCHEDULE[1]; // 2026-08-10 / goal 1500

  describe('bucketRaidTotals', () => {
    const keys = { '2026-08-09': 'ex_a', '2026-08-10': 'ex_b' };

    it('日ごと・ユーザーごとに、その日の種目だけ足す', () => {
      const totals = bucketRaidTotals(
        [
          { userId: 'u1', exerciseType: 'ex_a', value: 30, date: new Date('2026-08-09T03:00:00Z') },
          { userId: 'u1', exerciseType: 'ex_a', value: 20, date: new Date('2026-08-09T09:00:00Z') },
          { userId: 'u2', exerciseType: 'ex_a', value: 50, date: new Date('2026-08-09T09:00:00Z') },
          // その日の種目ではない → 数えない
          { userId: 'u1', exerciseType: 'ex_b', value: 99, date: new Date('2026-08-09T09:00:00Z') },
          { userId: 'u1', exerciseType: 'ex_b', value: 10, date: new Date('2026-08-10T03:00:00Z') },
        ],
        keys,
      );
      expect(totals['2026-08-09']).toEqual({ u1: 50, u2: 50 });
      expect(totals['2026-08-10']).toEqual({ u1: 10 });
    });

    it('JSTの日境界で振り分ける（UTC 15:00 = 翌日 0:00 JST）', () => {
      const totals = bucketRaidTotals(
        [
          { userId: 'u1', exerciseType: 'ex_a', value: 5, date: new Date('2026-08-09T14:59:59Z') },
          { userId: 'u1', exerciseType: 'ex_b', value: 7, date: new Date('2026-08-09T15:00:00Z') },
        ],
        keys,
      );
      expect(totals['2026-08-09']).toEqual({ u1: 5 });
      expect(totals['2026-08-10']).toEqual({ u1: 7 });
    });

    it('0以下・日程外・種目未定の日は無視する', () => {
      const totals = bucketRaidTotals(
        [
          { userId: 'u1', exerciseType: 'ex_a', value: 0, date: new Date('2026-08-09T03:00:00Z') },
          { userId: 'u1', exerciseType: 'ex_a', value: -3, date: new Date('2026-08-09T03:00:00Z') },
          { userId: 'u1', exerciseType: 'ex_c', value: 9, date: new Date('2026-08-11T03:00:00Z') },
        ],
        keys,
      );
      expect(totals).toEqual({});
    });
  });

  describe('buildRaidDayResult', () => {
    it('貢献度をそのまま点にし、参加者の点の合計は1日の持ち点になる', () => {
      const r = buildRaidDayResult(day1, 'ex_a', { u1: 250, u2: 750 }, USERS, 'u1');
      expect(r.totalValue).toBe(1000);
      expect(r.cleared).toBe(true);
      const sum = r.entries.reduce((s, e) => s + e.points, 0);
      expect(sum).toBeCloseTo(RAID_POINTS_PER_DAY, 10);
      expect(r.entries[0].userId).toBe('u2');
      expect(r.entries[0].points).toBeCloseTo(75, 10);
      expect(r.entries[1].points).toBeCloseTo(25, 10);
      expect(r.entries[1].isMe).toBe(true);
    });

    it('0回の人は成績表に並べない', () => {
      const r = buildRaidDayResult(day1, 'ex_a', { u1: 10, u2: 0 }, USERS, 'u1');
      expect(r.entries.map((e) => e.userId)).toEqual(['u1']);
      expect(r.entries[0].points).toBeCloseTo(100, 10);
    });

    it('誰も投稿していない日は空・未討伐', () => {
      const r = buildRaidDayResult(day1, 'ex_a', {}, USERS, 'u1');
      expect(r.entries).toEqual([]);
      expect(r.totalValue).toBe(0);
      expect(r.cleared).toBe(false);
    });
  });

  describe('buildRaidStandings', () => {
    it('日ごとの点を足し上げ、参加日数も数える', () => {
      const d1 = buildRaidDayResult(day1, 'ex_a', { u1: 250, u2: 750 }, USERS, 'u1');
      const d2 = buildRaidDayResult(day2, 'ex_b', { u1: 900, u3: 100 }, USERS, 'u1');
      const s = buildRaidStandings([d1, d2], USERS, 'u1');

      const byId = Object.fromEntries(s.map((r) => [r.userId, r]));
      expect(byId.u1.totalPoints).toBeCloseTo(25 + 90, 10);
      expect(byId.u1.activeDays).toBe(2);
      expect(byId.u2.totalPoints).toBeCloseTo(75, 10);
      expect(byId.u2.activeDays).toBe(1);
      expect(byId.u3.totalPoints).toBeCloseTo(10, 10);
      expect(byId.u1.isMe).toBe(true);
      expect(byId.u1.perDay['2026-08-09']).toBeCloseTo(25, 10);
    });

    it('点の高い順に並び、順位が入る', () => {
      const d1 = buildRaidDayResult(day1, 'ex_a', { u1: 250, u2: 750 }, USERS, 'u1');
      const d2 = buildRaidDayResult(day2, 'ex_b', { u1: 900, u3: 100 }, USERS, 'u1');
      const s = buildRaidStandings([d1, d2], USERS, 'u1');
      expect(s.map((r) => r.userId)).toEqual(['u1', 'u2', 'u3']);
      expect(s.map((r) => r.rank)).toEqual([1, 2, 3]);
    });

    it('同点は同順位で、次の順位は人数ぶん飛ぶ', () => {
      const d = buildRaidDayResult(day1, 'ex_a', { u1: 50, u2: 50, u3: 10 }, USERS, 'u1');
      const s = buildRaidStandings([d], USERS, 'u1');
      expect(s.map((r) => r.rank)).toEqual([1, 1, 3]);
    });

    it('投稿が無ければ空', () => {
      expect(buildRaidStandings([], USERS, 'u1')).toEqual([]);
    });
  });

  describe('formatRaidPoints', () => {
    it('整数は小数を出さず、端数は1桁', () => {
      expect(formatRaidPoints(25)).toBe('25');
      expect(formatRaidPoints(33.333)).toBe('33.3');
      expect(formatRaidPoints(66.666)).toBe('66.7');
      expect(formatRaidPoints(0)).toBe('0');
    });
  });
});


describe('ログイン人数 × 1人あたり', () => {
  const day1 = RAID_SCHEDULE[0]; // 固定 1000
  const day2 = RAID_SCHEDULE[1]; // 200/人

  it('固定目標の日は人数に影響されない', () => {
    expect(resolveRaidGoal(day1, 1)).toBe(1000);
    expect(resolveRaidGoal(day1, 8)).toBe(1000);
  });

  it('人数割の日は人数を掛ける', () => {
    expect(resolveRaidGoal(day2, 1)).toBe(200);
    expect(resolveRaidGoal(day2, 4)).toBe(800);
    expect(resolveRaidGoal(day2, 6)).toBe(1200);
  });

  it('人数が0でも1人ぶんは残す（目標0で即討伐にしない）', () => {
    expect(resolveRaidGoal(day2, 0)).toBe(200);
  });

  it('raidConfiguredValue はその日の編集対象の数字を返す', () => {
    expect(raidConfiguredValue(day1)).toBe(1000);
    expect(raidConfiguredValue(day2)).toBe(200);
  });

  it('上書きは人数割の日なら1人あたりを差し替える', () => {
    const o = applyRaidGoalOverride(day2, { '2026-08-10': 300 });
    expect(o.perPerson).toBe(300);
    expect(o.goalSource).toBe('override');
    expect(resolveRaidGoal(o, 5)).toBe(1500);
  });

  it('日程表の 250 前提が残っていないこと（2日目は200）', () => {
    expect(RAID_SCHEDULE[1].perPerson).toBe(200);
  });

  it('上書きは固定の日なら合計を差し替える', () => {
    const o = applyRaidGoalOverride(day1, { '2026-08-09': 1200 });
    expect(o.goal).toBe(1200);
    expect(o.perPerson).toBeUndefined();
    expect(resolveRaidGoal(o, 5)).toBe(1200);
  });

  it('ボスの体力は前日の記録人数から出る（当日の増減で動かない）', () => {
    const usersMap = {
      u1: { userName: 'あ', lastActiveDateKey: '2026-08-10' },
      u2: { userName: 'い', lastActiveDateKey: '2026-08-10' },
      u3: { userName: 'う', lastActiveDateKey: '2026-08-10' },
    };
    const r = buildRaidProgress({
      usersMap,
      dateKey: '2026-08-10',
      totals: { u1: 100 },
      myUserId: 'u1',
      config: day2,
      memberCounts: { '2026-08-09': 4 },
    });
    // 当日は3人ログインしているが、体力は前日の4人で決まる
    expect(r.memberCount).toBe(4);
    expect(r.memberCountDateKey).toBe('2026-08-09');
    expect(r.memberCountSource).toBe('recorded');
    expect(r.perPerson).toBe(200);
    expect(r.goal).toBe(800);
    expect(r.cleared).toBe(false);
  });

  it('前日の記録が無ければ「前日以降に開いた人数」で概算する', () => {
    const usersMap = {
      u1: { userName: 'あ', lastActiveDateKey: '2026-08-10' },
      u2: { userName: 'い', lastActiveDateKey: '2026-08-09' },
      u3: { userName: 'う', lastActiveDateKey: '2026-08-01' },
    };
    const r = buildRaidProgress({
      usersMap,
      dateKey: '2026-08-10',
      totals: {},
      myUserId: 'u1',
      config: day2,
      memberCounts: {},
    });
    // 8/9 以降に開いたのは u1/u2 の2人
    expect(r.memberCount).toBe(2);
    expect(r.memberCountSource).toBe('estimated');
    expect(r.goal).toBe(400);
  });

  it('固定目標の日は人数の情報を出さない', () => {
    const r = buildRaidProgress({
      usersMap: { u1: { userName: 'あ', lastActiveDateKey: '2026-08-09' } },
      dateKey: '2026-08-09',
      totals: {},
      myUserId: 'u1',
      config: day1,
      memberCounts: { '2026-08-08': 9 },
    });
    expect(r.goal).toBe(1000);
    expect(r.perPerson).toBeNull();
    expect(r.memberCountDateKey).toBeNull();
    expect(r.memberCountSource).toBeNull();
  });

  it('成績表は記録された人数で目標を再現し、無ければ投稿者数で代用する', () => {
    const users = { u1: { userName: 'あ' }, u2: { userName: 'い' } };
    const recorded = buildRaidDayResult(day2, 'ex', { u1: 400, u2: 400 }, users, 'u1', 5);
    expect(recorded.memberCount).toBe(5);
    expect(recorded.goal).toBe(1000);
    expect(recorded.cleared).toBe(false);

    const fallback = buildRaidDayResult(day2, 'ex', { u1: 400, u2: 400 }, users, 'u1');
    expect(fallback.memberCount).toBe(2);
    expect(fallback.goal).toBe(400);
    expect(fallback.cleared).toBe(true);
  });

  it('sanitizeRaidMemberCounts は日程内の妥当な整数だけ通す', () => {
    expect(
      sanitizeRaidMemberCounts({
        '2026-08-10': 5,
        '2026-08-11': 0,
        '2026-08-12': -1,
        '2026-08-13': 'x',
        '2099-01-01': 3,
      }),
    ).toEqual({ '2026-08-10': 5 });
    expect(sanitizeRaidMemberCounts(null)).toEqual({});
  });
});


describe('前日のログイン人数', () => {
  it('getPreviousDateKey は前日を返す（月またぎ・年またぎも）', () => {
    expect(getPreviousDateKey('2026-08-10')).toBe('2026-08-09');
    expect(getPreviousDateKey('2026-08-01')).toBe('2026-07-31');
    expect(getPreviousDateKey('2026-01-01')).toBe('2025-12-31');
    // うるう年の 3/1
    expect(getPreviousDateKey('2024-03-01')).toBe('2024-02-29');
  });

  it('countActiveUsersSince は指定日以降に開いた人だけ数える', () => {
    const users = {
      a: { lastActiveDateKey: '2026-08-10' },
      b: { lastActiveDateKey: '2026-08-09' },
      c: { lastActiveDateKey: '2026-08-08' },
      d: {},
    };
    expect(countActiveUsersSince(users, '2026-08-09')).toBe(2);
    expect(countActiveUsersSince(users, '2026-08-08')).toBe(3);
    expect(countActiveUsersSince({}, '2026-08-09')).toBe(0);
  });

  it('記録があればそれを、無ければ概算を使い、最低でも1人', () => {
    const users = { a: { lastActiveDateKey: '2026-08-09' } };
    const rec = resolveRaidMemberCount('2026-08-10', { '2026-08-09': 6 }, users);
    expect(rec).toEqual({ count: 6, dateKey: '2026-08-09', source: 'recorded' });

    const est = resolveRaidMemberCount('2026-08-10', {}, users);
    expect(est).toEqual({ count: 1, dateKey: '2026-08-09', source: 'estimated' });

    // 誰も該当しなくても 0 にはしない（体力0で即討伐を避ける）
    const none = resolveRaidMemberCount('2026-08-10', {}, {});
    expect(none.count).toBe(1);
  });

  it('別の日の記録は使わない', () => {
    const r = resolveRaidMemberCount('2026-08-12', { '2026-08-09': 6 }, {});
    expect(r.dateKey).toBe('2026-08-11');
    expect(r.source).toBe('estimated');
  });
});
