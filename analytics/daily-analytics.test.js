// node --test で実行（npm test）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyMissionDigest,
  dailyTargetProbability,
  dailyTargetTopShare,
  dayStartMs,
  generateDailyMissionTarget,
  pickDailyZone,
  replayDailyZoneWeek,
  resolveDailyPeak,
  resolveDailyPeriod,
} from './daily-analytics.js';

// ---------------------------------------------------------------------
// web/src/lib/daily-mission.ts との一致（web 版の関数で作った固定値。2026-11-08 に7領域で更新）
// [userId, dateKey, exerciseKey, peak, 領域(0〜6 / null=全域), 目標回数, 確率]
// 領域 null（導入前の全域抽選）の行は 11/01 に作った値から変わっていないこと。
// ---------------------------------------------------------------------
const GOLDEN = [
  ['UZqeErExyaRrqQrD216zkkSfpgs1', '2026-11-02', 'free_1780545539883', 5, null, 5, 0.5397010367838221],
  ['UZqeErExyaRrqQrD216zkkSfpgs1', '2026-11-02', 'free_1775234504740', 150, null, 157, 0.008292411350713791],
  ['UZqeErExyaRrqQrD216zkkSfpgs1', '2026-11-03', 'free_1775234504740', 41, null, 53, 0.0216535164913797],
  ['QGTsx53W25Wd5scfpBiJ87Q6PoC2', '2026-11-02', 'free_1775234504740', 12, null, 11, 0.1009169173693164],
  ['QGTsx53W25Wd5scfpBiJ87Q6PoC2', '2026-11-03', 'free_1775234504740', 5, null, 10, 0.01861795873432892],
  ['abc', '2026-11-02', 'free_1780545539883', 41, null, 20, 0.0033038575603492734],
  ['abc', '2026-11-03', 'free_1780545539883', 30, null, 21, 0.024127147902134688],
  ['abc', '2026-11-09', 'free_1780545539883', 30, 0, 18, 0.2575895096231847],
  ['abc', '2026-11-13', 'free_1780545539883', 30, 3, 32, 0.14171881002828404],
  ['abc', '2026-11-15', 'free_1780545539883', 30, 6, 57, 0.11324997566292597],
  ['QGTsx53W25Wd5scfpBiJ87Q6PoC2', '2026-11-11', 'free_1775234504740', 60, 4, 81, 0.07110317296590002],
  ['UZqeErExyaRrqQrD216zkkSfpgs1', '2026-12-31', 'free_1775234504740', 150, 5, 239, 0.02924413769695328],
];
// [userId, dateKey, 7つ全部が残っているときに引く領域]
const PICK_GOLDEN = [
  ['abc', '2026-11-09', 4],
  ['u7', '2026-11-12', 3],
  ['QGTsx53W25Wd5scfpBiJ87Q6PoC2', '2026-11-15', 1],
];
const ALL_ZONES = [0, 1, 2, 3, 4, 5, 6];

test('目標回数・確率・領域の抽選が web 版と一致する', () => {
  for (const [uid, dateKey, key, peak, zone, target, prob] of GOLDEN) {
    assert.equal(generateDailyMissionTarget(uid, dateKey, key, peak, zone), target, `${uid} ${dateKey} ${key} ${peak}`);
    assert.equal(dailyTargetProbability(target, peak, zone), prob);
  }
  for (const [uid, dateKey, zone] of PICK_GOLDEN) {
    assert.equal(pickDailyZone(uid, dateKey, ALL_ZONES, 30), zone);
  }
});

test('毎日クリアすれば7日で7領域を1回ずつ、サボれば軽い順に消える', () => {
  const week = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
  const days = week.map((dateKey) => ({ dateKey, kind: 'normal', exerciseKey: 'x', peak: 30 }));
  const all = {};
  week.forEach((d) => (all[d] = { u: 9999 }));
  const done = replayDailyZoneWeek('u', days, all);
  assert.deepEqual(done.days.map((d) => d.zone).sort(), ALL_ZONES);
  const skipped = replayDailyZoneWeek('u', days, {});
  assert.deepEqual(skipped.days.map((d) => d.removed), ALL_ZONES);
});

test('目標の重さ（その回数以上を引く確率）は回数が増えるほど小さい', () => {
  const peak = 100;
  assert.equal(dailyTargetTopShare(10, peak), 1); // 下限に丸め込まれる軽い目標
  const shares = [80, 100, 120, 150, 199].map((t) => dailyTargetTopShare(t, peak));
  for (let i = 1; i < shares.length; i++) assert.ok(shares[i] < shares[i - 1]);
  // 分布の中心は山（最頻値）より少し右なので、山以上を引く確率は半分を少し超える
  assert.ok(shares[1] > 0.5 && shares[1] < 0.7);
  // 上限（山の2倍）近くはほぼ引かない
  assert.ok(shares[4] < 0.02);
});

test('ピークは過去最高（投稿なしは既定30・下限5）', () => {
  assert.equal(resolveDailyPeak(0), 30);
  assert.equal(resolveDailyPeak(1), 5);
  assert.equal(resolveDailyPeak(40), 40);
});

// ---------------------------------------------------------------------
// 対象週
// ---------------------------------------------------------------------
test('対象週は export 日以前で最も新しい日曜で終わる月〜日', () => {
  // 日曜 16:45 JST の export → その日曜で終わる週
  assert.deepEqual(resolveDailyPeriod(Date.parse('2026-11-08T07:45:00Z')), { from: '2026-11-02', to: '2026-11-08' });
  // 月曜に遅れて回しても終わったばかりの週
  assert.deepEqual(resolveDailyPeriod(Date.parse('2026-11-09T03:00:00Z')), { from: '2026-11-02', to: '2026-11-08' });
  // 土曜
  assert.deepEqual(resolveDailyPeriod(Date.parse('2026-11-07T03:00:00Z')), { from: '2026-10-26', to: '2026-11-01' });
});

// ---------------------------------------------------------------------
// 集計
// ---------------------------------------------------------------------
const EX = 'ex_squat';
const exByKey = new Map([
  [EX, { key: EX, name: 'スクワット' }],
  ['ex_other', { key: 'ex_other', name: 'ほか' }],
  ['ch1', { key: 'ch1', name: '本戦1' }],
]);
const names = { u1: 'A', u2: 'B', u3: 'C' };
const nameOf = (uid) => names[uid] || uid;
const PEAK = 40;

/** dateKey の JST 正午の投稿 */
const post = (uid, dateKey, exerciseKey, value) => ({
  uid,
  exerciseKey,
  value,
  timestamp: new Date(dayStartMs(dateKey) + 12 * 3600 * 1000).toISOString(),
});
const targetOf = (uid, dateKey) => generateDailyMissionTarget(uid, dateKey, EX, PEAK);

function makeDataset({ history, posts, exportedAt = '2026-11-08T07:45:00Z' }) {
  return { meta: { exportedAt }, posts, dailyMission: { history } };
}

const WEEK = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
const fullHistory = Object.fromEntries(WEEK.map((k) => [k, { exerciseKey: EX, peak: PEAK, bestValue: PEAK }]));

test('7領域：前の日の消化を引き継ぐ（クリア→引いた領域 / 未クリア→一番軽い領域が消える）', () => {
  const ZW = ['2026-11-09', '2026-11-10', '2026-11-11'];
  // u1: 月曜をクリア / u2: 月曜は投稿なし（未クリア）。どちらも火曜に少しだけ投稿
  const monZone1 = pickDailyZone('u1', ZW[0], ALL_ZONES, PEAK);
  const monTarget1 = generateDailyMissionTarget('u1', ZW[0], EX, PEAK, monZone1);
  const days = ZW.slice(0, 2).map((dateKey) => ({ dateKey, kind: 'normal', exerciseKey: EX, peak: PEAK }));
  const totals = { [ZW[0]]: { u1: monTarget1 }, [ZW[1]]: { u1: 1, u2: 1 } };
  const r1 = replayDailyZoneWeek('u1', days, totals);
  assert.equal(r1.days[0].removed, monZone1);
  assert.equal(r1.days[0].removedBy, 'clear');
  const r2 = replayDailyZoneWeek('u2', days, totals);
  assert.equal(r2.days[0].removed, 0);
  assert.equal(r2.days[0].removedBy, 'skip');
  // 火曜は月曜の消化後の残りから引いている
  assert.ok(!r1.days[1].pool.includes(monZone1));
  assert.ok(r1.days[1].pool.includes(r1.days[1].zone));
});

test('7領域の週の週報：参加者の目標は、その人のその日の領域から出す', () => {
  const ZW = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'];
  const history = Object.fromEntries(ZW.map((k) => [k, { exerciseKey: EX, peak: PEAK, bestValue: PEAK }]));
  const monZone = pickDailyZone('u1', ZW[0], ALL_ZONES, PEAK);
  const monTarget = generateDailyMissionTarget('u1', ZW[0], EX, PEAK, monZone);
  const posts = [post('u1', ZW[0], EX, monTarget), post('u1', ZW[1], EX, 1), post('u2', ZW[1], EX, 1)];
  const out = buildDailyMissionDigest(
    makeDataset({ history, posts, exportedAt: '2026-11-15T07:45:00Z' }),
    { exByKey, nameOf },
  );
  assert.equal(out.period.from, '2026-11-09');
  const mon = out.days.find((d) => d.dateKey === ZW[0]);
  const monU1 = mon.participants.find((p) => p.userName === nameOf('u1'));
  assert.equal(monU1.zone, monZone + 1);
  assert.equal(monU1.target, monTarget);
  assert.equal(monU1.cleared, true);

  const days = ZW.slice(0, 2).map((dateKey) => ({ dateKey, kind: 'normal', exerciseKey: EX, peak: PEAK }));
  const totals = { [ZW[0]]: { u1: monTarget }, [ZW[1]]: { u1: 1, u2: 1 } };
  const tue = out.days.find((d) => d.dateKey === ZW[1]);
  for (const uid of ['u1', 'u2']) {
    const expected = replayDailyZoneWeek(uid, days, totals).days[1];
    const p = tue.participants.find((x) => x.userName === nameOf(uid));
    assert.equal(p.zone, expected.zone + 1, uid);
    assert.equal(p.target, expected.target, uid);
  }
});

test('history が無ければ null（推測で埋めない）', () => {
  assert.equal(buildDailyMissionDigest(makeDataset({ history: {}, posts: [] }), { exByKey, nameOf }), null);
});

test('目標・クリア・平日皆勤・連続クリアを数える', () => {
  const posts = [];
  // u1: 平日すべてクリア（土日はなし）
  WEEK.slice(0, 5).forEach((k) => posts.push(post('u1', k, EX, targetOf('u1', k))));
  // u2: 月火クリア、水は1回足りない、木は別種目だけ
  ['2026-11-02', '2026-11-03'].forEach((k) => posts.push(post('u2', k, EX, targetOf('u2', k))));
  posts.push(post('u2', '2026-11-04', EX, targetOf('u2', '2026-11-04') - 1));
  posts.push(post('u2', '2026-11-05', 'ex_other', 10));
  // 本戦種目への投稿（gate 用）
  posts.push(post('u1', '2026-11-02', 'ch1', 5));
  posts.push(post('u1', '2026-11-03', 'ch1', 5));

  const out = buildDailyMissionDigest(makeDataset({ history: fullHistory, posts }), {
    exByKey,
    nameOf,
    challengeKeys: ['ch1'],
  });
  assert.equal(out.period.from, '2026-11-02');
  assert.equal(out.days.length, 7);
  assert.equal(out.days[6].inProgress, true); // 日曜は集計時点で途中
  assert.equal(out.finishedDays, 6);
  assert.equal(out.finishedWeekdays, 5);
  assert.deepEqual(out.missingDays, []);

  const mon = out.days[0];
  assert.equal(mon.exerciseName, 'スクワット');
  assert.equal(mon.peak, PEAK);
  const a = mon.participants.find((p) => p.userName === 'A');
  assert.equal(a.target, targetOf('u1', '2026-11-02'));
  assert.equal(a.cleared, true);
  assert.equal(a.status, 'cleared');

  const wed = out.days[2].participants.find((p) => p.userName === 'B');
  assert.equal(wed.status, 'short');
  const thu = out.days[3].participants.find((p) => p.userName === 'B');
  assert.equal(thu.status, 'untouched');
  assert.equal(thu.totalValue, 0);

  const [first, second] = out.perUser;
  assert.deepEqual(
    { name: first.userName, wd: first.weekdayClearDays, all: first.allWeekdaysCleared, streak: first.clearStreak },
    { name: 'A', wd: 5, all: true, streak: 5 }
  );
  assert.deepEqual(
    { name: second.userName, wd: second.weekdayClearDays, att: second.attemptDays, active: second.activeDays, streak: second.clearStreak },
    { name: 'B', wd: 2, att: 3, active: 4, streak: 2 }
  );

  // あと1回で届かず（目標が5以上なら達成率は80%以上）
  assert.ok(out.highlights.nearMisses.some((m) => m.userName === 'B' && m.short === 1));
  // 月火は動いた2人ともクリア
  assert.deepEqual(out.highlights.allClearDays, ['2026-11-02', '2026-11-03']);

  assert.deepEqual(out.gate.find((g) => g.userName === 'A'), { userName: 'A', weekdayClearDays: 5, weeklyPostDays: 2 });
  // 出力に uid を残さない
  assert.equal(JSON.stringify(out).includes('"uid"'), false);
});

test('記録の無い日は missingDays に出し、連続クリアはそこで途切れる', () => {
  const history = { ...fullHistory };
  delete history['2026-11-04'];
  const posts = WEEK.slice(0, 5).map((k) => post('u1', k, EX, 999));
  const out = buildDailyMissionDigest(makeDataset({ history, posts }), { exByKey, nameOf });
  assert.deepEqual(out.missingDays, ['2026-11-04']);
  assert.equal(out.days.some((d) => d.dateKey === '2026-11-04'), false);
  const a = out.perUser[0];
  assert.equal(a.weekdayClearDays, 4);
  assert.equal(a.clearStreak, 2);
  assert.equal(a.allWeekdaysCleared, true); // 判定できた平日はすべてクリア
  assert.equal(out.gate, null); // 本戦種目が分からなければ gate は出さない
});

test('ピーク未集計（引き直し直後）の日は当日より前の最大から再計算する', () => {
  const history = { '2026-11-02': { exerciseKey: EX, peak: null, bestValue: null, rerolledFrom: ['old'] } };
  const posts = [
    post('u3', '2026-10-20', EX, 25), // 過去最高 25 → ピーク 25
    post('u3', '2026-11-02', EX, 300), // 当日の投稿はピークに含めない
  ];
  const out = buildDailyMissionDigest(makeDataset({ history, posts }), { exByKey, nameOf });
  const mon = out.days[0];
  assert.equal(mon.peak, 25);
  assert.equal(mon.peakSource, 'recomputed');
  assert.equal(mon.rerolled, true);
  assert.equal(mon.participants[0].target, generateDailyMissionTarget('u3', '2026-11-02', EX, 25));
});

test('鬼目標は上位10%以内の目標を突破したときだけ', () => {
  const dateKey = '2026-11-02';
  const history = { [dateKey]: { exerciseKey: EX, peak: PEAK, bestValue: PEAK } };
  const uids = Array.from({ length: 40 }, (_, i) => `user${i}`);
  const posts = uids.map((u) => post(u, dateKey, EX, 9999));
  const out = buildDailyMissionDigest(makeDataset({ history, posts }), { exByKey, nameOf });
  const all = out.days[0].participants;
  const heavy = all.filter((p) => p.topShare <= 0.1).sort((a, b) => a.topShare - b.topShare);
  assert.ok(heavy.length < all.length);
  assert.deepEqual(
    out.highlights.rareClears.map((r) => [r.userName, r.target]),
    heavy.slice(0, 3).map((p) => [p.userName, p.target])
  );
});

test('レイド日は全員の合計で判定し、個人の通算には入れない', () => {
  const history = { '2026-11-02': { exerciseKey: EX, peak: null, bestValue: null, raidDay: 1, raidGoal: 100 } };
  const posts = [post('u1', '2026-11-02', EX, 60), post('u2', '2026-11-02', EX, 50)];
  const out = buildDailyMissionDigest(makeDataset({ history, posts }), { exByKey, nameOf });
  const raid = out.days[0].raid;
  assert.deepEqual(
    { day: raid.day, goal: raid.goal, teamTotal: raid.teamTotal, cleared: raid.cleared, top: raid.contributors[0].userName },
    { day: 1, goal: 100, teamTotal: 110, cleared: true, top: 'A' }
  );
  assert.deepEqual(out.perUser, []);
});
