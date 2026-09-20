import { describe, it, expect } from 'vitest';
import {
  DEFAULT_START_WEIGHT,
  buildStepChart,
  TARGET_REPS,
  formatWeight,
  isCleared,
  progressOf,
  rankByClearedWeight,
  shortfallOf,
  validateAttempt,
  weightHistory,
  type DropsetAttempt,
} from '../dropset';

const BENCH = 'ds_bench';
const SQUAT = 'ds_squat';
const EX = { startWeight: 40, step: 2.5 };

/** 日付は相対順序だけが意味を持つので、日単位のヘルパーで十分 */
const day = (d: number): Date => new Date(Date.UTC(2026, 8, d, 3));

function attempt(
  userId: string,
  weight: number,
  reps: number[],
  d: number,
  exerciseType = BENCH,
): DropsetAttempt {
  return {
    userId,
    exerciseType,
    weight,
    reps,
    target: [...TARGET_REPS],
    cleared: isCleared(reps),
    timestamp: day(d),
  };
}

describe('isCleared（10-8-6 をすべて満たすか）', () => {
  it('ちょうど 10-8-6 はクリア', () => {
    expect(isCleared([10, 8, 6])).toBe(true);
  });
  it('各セット目標以上ならクリア', () => {
    expect(isCleared([12, 9, 6])).toBe(true);
  });
  it('1セットでも足りなければ未クリア', () => {
    expect(isCleared([10, 8, 5])).toBe(false);
    expect(isCleared([9, 8, 6])).toBe(false);
  });
  it('セット数が足りない・未入力は未クリア', () => {
    expect(isCleared([10, 8])).toBe(false);
    expect(isCleared([])).toBe(false);
    expect(isCleared(undefined)).toBe(false);
  });
  it('合計が足りていてもセットごとに満たさなければ未クリア', () => {
    // 合計24回で 10+8+6 と同じだが、2セット目が目標未満
    expect(isCleared([14, 4, 6])).toBe(false);
  });
});

describe('shortfallOf（あと何回）', () => {
  it('クリア済みなら空', () => {
    expect(shortfallOf([10, 8, 6])).toEqual([]);
  });
  it('不足しているセットの差を返す', () => {
    expect(shortfallOf([10, 8, 5])).toEqual([0, 0, 1]);
    expect(shortfallOf([7, 8, 4])).toEqual([3, 0, 2]);
  });
});

describe('progressOf（進捗の導出）', () => {
  it('記録が無ければ種目の開始重量を提案', () => {
    const p = progressOf([], 'u1', BENCH, EX);
    expect(p.clearedMax).toBeNull();
    expect(p.suggestedWeight).toBe(40);
    expect(p.attempts).toBe(0);
    expect(p.stalledCount).toBe(0);
  });

  it('種目未設定なら既定の開始重量を使う', () => {
    expect(progressOf([], 'u1', BENCH, null).suggestedWeight).toBe(
      DEFAULT_START_WEIGHT,
    );
  });

  it('クリアすると次は +step の重量を提案', () => {
    const posts = [attempt('u1', 40, [10, 8, 6], 1)];
    const p = progressOf(posts, 'u1', BENCH, EX);
    expect(p.clearedMax).toBe(40);
    expect(p.suggestedWeight).toBe(42.5);
    expect(p.stalledCount).toBe(0);
  });

  it('停滞しても提案重量は変わらず、連続失敗を数える', () => {
    const posts = [
      attempt('u1', 40, [10, 8, 6], 1),
      attempt('u1', 42.5, [10, 8, 5], 2),
      attempt('u1', 42.5, [10, 7, 6], 3),
    ];
    const p = progressOf(posts, 'u1', BENCH, EX);
    expect(p.clearedMax).toBe(40);
    expect(p.suggestedWeight).toBe(42.5);
    expect(p.stalledCount).toBe(2);
    expect(p.attempts).toBe(3);
    expect(p.lastAttempt?.reps).toEqual([10, 7, 6]);
  });

  it('2.5kg を積み上げても小数誤差が出ない', () => {
    const posts = [
      attempt('u1', 62.5, [10, 8, 6], 1),
      attempt('u1', 65, [10, 8, 6], 2),
    ];
    expect(progressOf(posts, 'u1', BENCH, EX).suggestedWeight).toBe(67.5);
  });

  it('飛び級（提案より重い重量をクリア）にも追従する', () => {
    const posts = [
      attempt('u1', 40, [10, 8, 6], 1),
      attempt('u1', 60, [10, 8, 6], 2), // 提案は 42.5 だったが 60 に挑んでクリア
    ];
    const p = progressOf(posts, 'u1', BENCH, EX);
    expect(p.clearedMax).toBe(60);
    expect(p.suggestedWeight).toBe(62.5);
  });

  it('軽い重量をあとからクリアしても最大重量は下がらない', () => {
    const posts = [
      attempt('u1', 60, [10, 8, 6], 1),
      attempt('u1', 50, [10, 8, 6], 2),
    ];
    const p = progressOf(posts, 'u1', BENCH, EX);
    expect(p.clearedMax).toBe(60);
    expect(p.suggestedWeight).toBe(62.5);
  });

  it('他人・他種目の記録は混ざらない', () => {
    const posts = [
      attempt('u2', 100, [10, 8, 6], 1),
      attempt('u1', 100, [10, 8, 6], 1, SQUAT),
    ];
    const p = progressOf(posts, 'u1', BENCH, EX);
    expect(p.clearedMax).toBeNull();
    expect(p.suggestedWeight).toBe(40);
  });

  it('停滞のあとにクリアすると連続失敗はリセットされる', () => {
    const posts = [
      attempt('u1', 42.5, [10, 8, 5], 1),
      attempt('u1', 42.5, [10, 8, 6], 2),
    ];
    const p = progressOf(posts, 'u1', BENCH, EX);
    expect(p.suggestedWeight).toBe(45);
    expect(p.stalledCount).toBe(0);
  });

  it('timestamp 未確定（投稿直後）の記録は最新として扱う', () => {
    const posts: DropsetAttempt[] = [
      attempt('u1', 40, [10, 8, 6], 1),
      {
        userId: 'u1',
        exerciseType: BENCH,
        weight: 42.5,
        reps: [10, 8, 4],
        cleared: false,
        timestamp: null,
      },
    ];
    const p = progressOf(posts, 'u1', BENCH, EX);
    expect(p.lastAttempt?.weight).toBe(42.5);
    expect(p.stalledCount).toBe(1);
  });

  it('cleared が未保存でも reps から判定する', () => {
    const posts: DropsetAttempt[] = [
      {
        userId: 'u1',
        exerciseType: BENCH,
        weight: 40,
        reps: [10, 8, 6],
        timestamp: day(1),
      },
    ];
    expect(progressOf(posts, 'u1', BENCH, EX).clearedMax).toBe(40);
  });
});

describe('rankByClearedWeight（クリア重量の絶対値で降順）', () => {
  it('重い順に並ぶ', () => {
    const posts = [
      attempt('u1', 60, [10, 8, 6], 1),
      attempt('u2', 80, [10, 8, 6], 1),
      attempt('u3', 70, [10, 8, 6], 1),
    ];
    expect(rankByClearedWeight(posts, BENCH).map((r) => r.userId)).toEqual([
      'u2',
      'u3',
      'u1',
    ]);
  });

  it('同じ重量なら先に到達した人が上位', () => {
    const posts = [
      attempt('u1', 60, [10, 8, 6], 5),
      attempt('u2', 60, [10, 8, 6], 2),
    ];
    expect(rankByClearedWeight(posts, BENCH).map((r) => r.userId)).toEqual([
      'u2',
      'u1',
    ]);
  });

  it('同じ重量を複数回クリアしたら最初の到達日時を採用', () => {
    const posts = [
      attempt('u1', 60, [10, 8, 6], 2),
      attempt('u1', 60, [10, 8, 6], 9),
      attempt('u2', 60, [10, 8, 6], 5),
    ];
    const rows = rankByClearedWeight(posts, BENCH);
    expect(rows.map((r) => r.userId)).toEqual(['u1', 'u2']);
    expect(rows[0].clearedAt).toEqual(day(2));
  });

  it('未クリアの人は載らない', () => {
    const posts = [
      attempt('u1', 60, [10, 8, 5], 1),
      attempt('u2', 40, [10, 8, 6], 1),
    ];
    expect(rankByClearedWeight(posts, BENCH).map((r) => r.userId)).toEqual([
      'u2',
    ]);
  });

  it('他種目は混ざらない', () => {
    const posts = [attempt('u1', 200, [10, 8, 6], 1, SQUAT)];
    expect(rankByClearedWeight(posts, BENCH)).toEqual([]);
  });
});

describe('weightHistory（重量推移の階段）', () => {
  it('自己ベスト更新時だけ点を打つ', () => {
    const posts = [
      attempt('u1', 40, [10, 8, 6], 1),
      attempt('u1', 42.5, [10, 8, 5], 2), // 停滞は階段に出ない
      attempt('u1', 42.5, [10, 8, 6], 3),
      attempt('u1', 42.5, [10, 8, 6], 4), // 同じ重量の再クリアは出ない
      attempt('u1', 45, [10, 8, 6], 5),
    ];
    expect(weightHistory(posts, 'u1', BENCH)).toEqual([
      { t: day(1).getTime(), weight: 40 },
      { t: day(3).getTime(), weight: 42.5 },
      { t: day(5).getTime(), weight: 45 },
    ]);
  });

  it('時系列が前後していても古い順に並ぶ', () => {
    const posts = [
      attempt('u1', 45, [10, 8, 6], 5),
      attempt('u1', 40, [10, 8, 6], 1),
    ];
    expect(weightHistory(posts, 'u1', BENCH).map((p) => p.weight)).toEqual([
      40, 45,
    ]);
  });

  it('timestamp が無い記録は階段に含めない', () => {
    const posts: DropsetAttempt[] = [
      { userId: 'u1', exerciseType: BENCH, weight: 40, reps: [10, 8, 6], timestamp: null },
    ];
    expect(weightHistory(posts, 'u1', BENCH)).toEqual([]);
  });
});

describe('formatWeight', () => {
  it('整数は小数点を出さない', () => {
    expect(formatWeight(60)).toBe('60');
    expect(formatWeight(62.5)).toBe('62.5');
    expect(formatWeight(62.50000000000001)).toBe('62.5');
  });
});

describe('validateAttempt', () => {
  it('正常な入力は null', () => {
    expect(validateAttempt(60, [10, 8, 6])).toBeNull();
    expect(validateAttempt(60, [0, 0, 0])).toBeNull();
  });
  it('重量の範囲外はエラー', () => {
    expect(validateAttempt(0, [10, 8, 6])).not.toBeNull();
    expect(validateAttempt(1001, [10, 8, 6])).not.toBeNull();
    expect(validateAttempt(NaN, [10, 8, 6])).not.toBeNull();
  });
  it('セット数が足りなければエラー', () => {
    expect(validateAttempt(60, [10, 8])).not.toBeNull();
  });
  it('回数が整数でない・範囲外ならエラー', () => {
    expect(validateAttempt(60, [10, 8, 6.5])).not.toBeNull();
    expect(validateAttempt(60, [10, 8, -1])).not.toBeNull();
    expect(validateAttempt(60, [10, 8, 1000])).not.toBeNull();
  });
});

describe('buildStepChart（重量推移グラフの座標）', () => {
  const GEOM = {
    width: 320,
    height: 180,
    padL: 36,
    padR: 12,
    padT: 14,
    padB: 24,
  };
  const pt = (d: number, weight: number) => ({ t: day(d).getTime(), weight });

  it('点が無ければ null', () => {
    expect(buildStepChart([], GEOM)).toBeNull();
  });

  it('左端から右端まで、時間の比率どおりに x が決まる', () => {
    const l = buildStepChart([pt(1, 40), pt(3, 45), pt(5, 50)], GEOM)!;
    expect(l.points[0].x).toBe(36); // padL
    expect(l.points[2].x).toBe(320 - 12); // width - padR
    // 1日目→3日目→5日目 は等間隔なので真ん中
    expect(l.points[1].x).toBeCloseTo((36 + 308) / 2, 6);
  });

  it('日付の間隔が偏っていれば x も偏る', () => {
    const l = buildStepChart([pt(1, 40), pt(2, 45), pt(11, 50)], GEOM)!;
    const innerW = 320 - 36 - 12;
    expect(l.points[1].x).toBeCloseTo(36 + innerW / 10, 6);
  });

  it('重いほど y が小さい（上に描かれる）', () => {
    const l = buildStepChart([pt(1, 40), pt(3, 60)], GEOM)!;
    expect(l.points[1].y).toBeLessThan(l.points[0].y);
    expect(l.points[0].y).toBeLessThan(l.baselineY);
    expect(l.points[1].y).toBeGreaterThan(GEOM.padT);
  });

  it('Y軸の範囲は最初と最新の重量を内側に含む', () => {
    const l = buildStepChart([pt(1, 40), pt(3, 60)], GEOM)!;
    expect(l.minV).toBeLessThan(40);
    expect(l.maxV).toBeGreaterThan(60);
    expect(l.first).toBe(40);
    expect(l.peak).toBe(60);
  });

  it('重量が1種類しかなくてもY軸が潰れない', () => {
    const l = buildStepChart([pt(1, 60), pt(3, 60)], GEOM)!;
    expect(l.maxV).toBeGreaterThan(l.minV);
    expect(Number.isFinite(l.points[0].y)).toBe(true);
  });

  it('マイナスの重量域には広げない', () => {
    const l = buildStepChart([pt(1, 1), pt(3, 2)], GEOM)!;
    expect(l.minV).toBeGreaterThanOrEqual(0);
  });

  it('階段になっている（横に進んでから垂直に上がる）', () => {
    const l = buildStepChart([pt(1, 40), pt(3, 45)], GEOM)!;
    const [x0, y0] = [l.points[0].x, l.points[0].y];
    const [x1, y1] = [l.points[1].x, l.points[1].y];
    // M x0 y0 → L x1 y0（横） → L x1 y1（縦） → L 右端 y1
    expect(l.linePath).toBe(
      `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${l.rightX} ${y1}`,
    );
  });

  it('現在の重量は右端まで伸びる', () => {
    const l = buildStepChart([pt(1, 40), pt(3, 45)], GEOM)!;
    expect(l.linePath.endsWith(`L ${l.rightX} ${l.points[1].y}`)).toBe(true);
  });

  it('1点だけでも右端まで水平線が引ける', () => {
    const l = buildStepChart([pt(1, 40)], GEOM)!;
    expect(l.points).toHaveLength(1);
    expect(l.linePath).toBe(`M 36 ${l.points[0].y} L ${l.rightX} ${l.points[0].y}`);
  });

  it('同時刻の点が並んでも等間隔に逃がす', () => {
    const l = buildStepChart([pt(1, 40), pt(1, 45), pt(1, 50)], GEOM)!;
    const xs = l.points.map((p) => p.x);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
    expect(xs[2]).toBe(l.rightX);
  });

  it('塗りパスは底辺から始まり底辺で閉じる', () => {
    const l = buildStepChart([pt(1, 40), pt(3, 45)], GEOM)!;
    expect(l.areaPath.startsWith(`M ${l.points[0].x} ${l.baselineY} L `)).toBe(
      true,
    );
    expect(l.areaPath.endsWith(`L ${l.rightX} ${l.baselineY} Z`)).toBe(true);
    expect(l.areaPath).not.toContain('M 36 ' + l.points[0].y);
  });
});
