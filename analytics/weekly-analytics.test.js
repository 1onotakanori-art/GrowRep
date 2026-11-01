// node --test で実行（npm test）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChallengeSections } from './weekly-analytics.js';

const exByKey = new Map([
  ['a', { key: 'a', name: '種目A' }],
  ['b', { key: 'b', name: '種目B' }],
]);
const nameOf = (uid) => uid;
const DAY = 24 * 60 * 60 * 1000;

/** 日曜の日付 → その日 17:00 JST の週開始（ISO） */
const weekStart = (sunday) => new Date(Date.parse(`${sunday}T08:00:00Z`)).toISOString();
const weekEnd = (sunday) => new Date(Date.parse(`${sunday}T08:00:00Z`) + 7 * DAY).toISOString();
const champ = (id, sunday) => ({
  id,
  weekStart: weekStart(sunday),
  weekEnd: weekEnd(sunday),
  exerciseTop5: { a: [], b: [] },
});
const post = (uid, iso, exerciseKey, value) => ({ uid, exerciseKey, value, timestamp: iso });

function ds({ exportedAt, champions = [], posts = [], weeklyOverrides = {} }) {
  return {
    meta: { exportedAt },
    posts,
    users: [],
    exercises: [...exByKey.values()],
    weeklyChampions: champions,
    // 月間ダービーは history（＋ライブ）から週を集める。実データと同じく champion と同じ週を入れておく
    weeklyHistory: champions.map((c) => ({ id: c.id, weekStart: c.weekStart, weekEnd: c.weekEnd, exercises: Object.keys(c.exerciseTop5) })),
    weeklyChallenge: null,
    weeklyOverrides,
  };
}

test('直近に終わった週が休止週なら paused（前の週を先週として出さない）', () => {
  // 8/9(日)17時〜の週が休止。8/16(日)の週報
  const out = buildChallengeSections(
    ds({ exportedAt: '2026-08-16T07:45:00Z', champions: [champ('2026_W31', '2026-08-02')] }),
    exByKey,
    nameOf
  );
  assert.equal(out.weeklyChallenge.paused, true);
  assert.equal(out.weeklyChallenge.period.label, '8/10(月)〜8/14(金)');
  assert.deepEqual(out.weeklyChallenge.standings, []);
});

test('休止週でなければ paused: false で通常の集計', () => {
  const out = buildChallengeSections(
    ds({
      exportedAt: '2026-11-01T07:45:00Z',
      champions: [champ('2026_W43', '2026-10-25')],
      posts: [post('u1', '2026-10-27T03:00:00Z', 'a', 10), post('u2', '2026-10-27T03:00:00Z', 'a', 5)],
    }),
    exByKey,
    nameOf
  );
  assert.equal(out.weeklyChallenge.paused, false);
  assert.equal(out.weeklyChallenge.champion.userName, 'u1');
  assert.equal(out.weeklyChallenge.overrideLabel, null);
});

test('特別イベント週のラベルは週ごとの上書き設定から引く', () => {
  const out = buildChallengeSections(
    ds({
      exportedAt: '2026-11-01T07:45:00Z',
      champions: [champ('2026_W43', '2026-10-25')],
      posts: [post('u1', '2026-10-27T03:00:00Z', 'a', 10)],
      weeklyOverrides: {
        'weekly_override_2026-10-26': { exercises: ['a', 'b'], label: 'ハロウィン杯', invalidated: false },
      },
    }),
    exByKey,
    nameOf
  );
  assert.equal(out.weeklyChallenge.overrideLabel, 'ハロウィン杯');
});

test('月間ダービーは最終週の金曜が終わったら確定（最終日の日曜の週報で戴冠できる）', () => {
  const champions = [
    champ('2026_W40', '2026-10-04'),
    champ('2026_W41', '2026-10-11'),
    champ('2026_W42', '2026-10-18'),
    champ('2026_W43', '2026-10-25'),
  ];
  const posts = [post('u1', '2026-10-27T03:00:00Z', 'a', 10)];
  // 10月ダービーの最終日 11/1(日) の週報
  const last = buildChallengeSections(ds({ exportedAt: '2026-11-01T07:45:00Z', champions, posts }), exByKey, nameOf);
  assert.equal(last.monthlyDerby.month, 10);
  assert.equal(last.monthlyDerby.monthOver, true);
  assert.equal(last.monthlyDerby.champion.userName, 'u1');
  // 1週前（10/25）の週報ではまだ暫定
  const prev = buildChallengeSections(
    ds({ exportedAt: '2026-10-25T07:45:00Z', champions: champions.slice(0, 3), posts }),
    exByKey,
    nameOf
  );
  assert.equal(prev.monthlyDerby.monthOver, false);
  assert.equal(prev.monthlyDerby.champion, null);
});
