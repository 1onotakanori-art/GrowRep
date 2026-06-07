/**
 * ② 集計（digest ビルド）
 * --------------------------------------------------------------
 * dataset.json を読み込み、AI に解釈させる前の「事実」を決定論的に計算する。
 * （LLM に算数をさせない設計：数値はここで確定、Cowork は解釈・物語化に専念）
 *
 * 出力（exports/YYYY-MM-DD/ 内）:
 *   - digest.json        … 機械可読の集計結果（Cowork に渡す）
 *   - posts.flat.jsonl   … 1行1投稿の denormalize 済みデータ
 *   - dashboard.html     … 人間向けの自己完結ビジュアルダッシュボード
 *
 * 使い方:
 *   npm run digest                       （exports 内の最新日付フォルダを処理）
 *   npm run digest -- --date=2026-06-06  （日付指定）
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildChallengeSections } from './weekly-analytics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

const EXPORTS_DIR = join(__dirname, 'exports');

function latestDateDir() {
  if (!existsSync(EXPORTS_DIR)) return null;
  const dirs = readdirSync(EXPORTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
    .map((d) => d.name)
    .sort();
  return dirs.length ? dirs[dirs.length - 1] : null;
}

const dateStr = typeof args.date === 'string' ? args.date : latestDateDir();
if (!dateStr) {
  console.error('[digest] 処理対象が見つかりません。先に npm run export を実行してください。');
  process.exit(1);
}

const outDir = join(EXPORTS_DIR, dateStr);
const datasetPath = join(outDir, 'dataset.json');
if (!existsSync(datasetPath)) {
  console.error(`[digest] dataset.json がありません: ${datasetPath}`);
  process.exit(1);
}

const ds = JSON.parse(readFileSync(datasetPath, 'utf8'));

// ====================================================================
// ヘルパー
// ====================================================================
const DAY = 24 * 60 * 60 * 1000;
const exportTime = new Date(ds.meta?.exportedAt || Date.now()).getTime();

function tsMs(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

// JST (UTC+9) のカレンダー要素を返す
function jstParts(iso) {
  const t = tsMs(iso);
  if (t === null) return null;
  const d = new Date(t + 9 * 60 * 60 * 1000);
  return {
    date: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
      d.getUTCDate()
    ).padStart(2, '0')}`,
    weekday: d.getUTCDay(), // 0=日
    hour: d.getUTCHours(),
  };
}

function round(n, p = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

// 単回帰 y = a + b*x の傾き b（x:日数, y:value）
function linregSlope(points) {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den; // value / day
}

// 値配列に対する percentileRank（0-100）。same値は中央扱い。
function percentileRank(sorted, v) {
  const n = sorted.length;
  if (n < 2) return null;
  let below = 0;
  let equal = 0;
  for (const x of sorted) {
    if (x < v) below += 1;
    else if (x === v) equal += 1;
  }
  return round(((below + equal / 2) / n) * 100, 1);
}

const userByUid = new Map(ds.users.map((u) => [u.uid, u]));
const exByKey = new Map(ds.exercises.map((e) => [e.key, e]));
const nameOf = (uid) => userByUid.get(uid)?.userName || uid || '不明';

// ====================================================================
// posts.flat（denormalize）
// ====================================================================
const flat = [];
for (const p of ds.posts) {
  const ex = exByKey.get(p.exerciseKey);
  const jp = jstParts(p.timestamp);
  flat.push({
    postId: p.id,
    date: jp?.date || null,
    timestamp: p.timestamp,
    weekday: jp?.weekday ?? null,
    hour: jp?.hour ?? null,
    uid: p.uid,
    user: nameOf(p.uid),
    exerciseKey: p.exerciseKey,
    exercise: ex?.name || p.exerciseKey,
    tags: ex?.tags || [],
    value: p.value,
    likes: p.likes.length,
    comments: p.comments.length,
  });
}
flat.sort((a, b) => (tsMs(a.timestamp) || 0) - (tsMs(b.timestamp) || 0));

// ====================================================================
// 種目ごとのベスト値分布 → パーセンタイル基盤
// ====================================================================
// exerciseKey -> { uid -> bestValue }
const bestByExUser = new Map();
for (const p of ds.posts) {
  if (!p.exerciseKey || !p.uid) continue;
  if (!bestByExUser.has(p.exerciseKey)) bestByExUser.set(p.exerciseKey, new Map());
  const m = bestByExUser.get(p.exerciseKey);
  m.set(p.uid, Math.max(m.get(p.uid) ?? -Infinity, p.value));
}
// exerciseKey -> sorted best values（パーセンタイル算出用）
const bestSortedByEx = new Map();
for (const [k, m] of bestByExUser) {
  bestSortedByEx.set(k, [...m.values()].sort((a, b) => a - b));
}

// ====================================================================
// ユーザー別集計
// ====================================================================
const userAgg = new Map(); // uid -> agg
for (const u of ds.users) {
  userAgg.set(u.uid, {
    uid: u.uid,
    userName: u.userName,
    isGuest: u.isGuest,
    totalPosts: 0,
    activeDates: new Set(),
    weekday: Array(7).fill(0),
    hour: Array(24).fill(0),
    likesGiven: 0,
    likesReceived: 0,
    commentsGiven: 0,
    commentsReceived: 0,
    firstPost: null,
    lastPost: null,
    perExercise: new Map(), // key -> { values:[{x,y,t}], count, best, first, last }
    pbThisWeek: 0,
    postsThisWeek: 0,
    creator: {
      createdCount: ds.exercises.filter((e) => e.createdBy === u.uid).length,
      avgRating: u.creatorAvgRating,
      ratedCount: u.creatorRatedExerciseCount || 0,
    },
  });
}

// 投稿を走査
for (const p of ds.posts) {
  const a = userAgg.get(p.uid);
  const t = tsMs(p.timestamp);
  // ソーシャル（投稿者側）
  if (a) {
    a.likesReceived += p.likes.length;
    a.commentsReceived += p.comments.length;
  }
  // いいね・コメントを「与えた」側
  for (const likerUid of p.likes) {
    const la = userAgg.get(likerUid);
    if (la) la.likesGiven += 1;
  }
  for (const c of p.comments) {
    const ca = userAgg.get(c.uid);
    if (ca) ca.commentsGiven += 1;
  }
  if (!a || !p.exerciseKey) continue;

  a.totalPosts += 1;
  const jp = jstParts(p.timestamp);
  if (jp) {
    a.activeDates.add(jp.date);
    a.weekday[jp.weekday] += 1;
    a.hour[jp.hour] += 1;
  }
  if (t !== null) {
    if (a.firstPost === null || t < a.firstPost) a.firstPost = t;
    if (a.lastPost === null || t > a.lastPost) a.lastPost = t;
    if (exportTime - t < 7 * DAY) a.postsThisWeek += 1;
  }
  if (!a.perExercise.has(p.exerciseKey)) {
    a.perExercise.set(p.exerciseKey, { values: [], count: 0, best: -Infinity });
  }
  const pe = a.perExercise.get(p.exerciseKey);
  pe.values.push({ t, y: p.value });
  pe.count += 1;
  pe.best = Math.max(pe.best, p.value);
}

// 連続日数（ストリーク）計算
function streaks(dateSet, refDate) {
  const dates = [...dateSet].sort();
  if (dates.length === 0) return { longest: 0, current: 0 };
  const toNum = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / DAY;
  };
  const nums = dates.map(toNum);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === nums[i - 1] + 1) run += 1;
    else if (nums[i] !== nums[i - 1]) run = 1;
    longest = Math.max(longest, run);
  }
  // current: 最終投稿日から遡る連続日数（基準日との差が1以内で継続中とみなす）
  const refNum = toNum(refDate);
  const last = nums[nums.length - 1];
  let current = 0;
  if (refNum - last <= 1) {
    current = 1;
    for (let i = nums.length - 1; i > 0; i--) {
      if (nums[i] === nums[i - 1] + 1) current += 1;
      else break;
    }
  }
  return { longest, current };
}

// ====================================================================
// ユーザー別: パーセンタイル / 成長 / タグ強み / 強み弱み
// ====================================================================
const allTags = new Set();
for (const e of ds.exercises) for (const tg of e.tags) allTags.add(tg);

const tagExerciseCount = new Map();
for (const e of ds.exercises) for (const tg of e.tags) tagExerciseCount.set(tg, (tagExerciseCount.get(tg) || 0) + 1);

const users = [];
for (const a of userAgg.values()) {
  if (a.totalPosts === 0 && a.likesGiven === 0 && a.commentsGiven === 0) {
    // 完全に活動のないユーザーはスキップ（ゲスト等）
    // ただし名簿には残す用に最小限の情報だけ
  }
  const st = streaks(a.activeDates, ds.meta?.exportDate || dateStr);

  // 種目ごとの指標
  const perExercise = [];
  const userTagPercentiles = new Map(); // tag -> [percentile]
  let pbThisWeek = 0;
  for (const [key, pe] of a.perExercise) {
    const ex = exByKey.get(key);
    const ordered = pe.values.filter((v) => v.t !== null).sort((x, y) => x.t - y.t);
    const firstValue = ordered.length ? ordered[0].y : null;
    const lastValue = ordered.length ? ordered[ordered.length - 1].y : null;
    const t0 = ordered.length ? ordered[0].t : null;
    const points = ordered.map((v) => ({ x: (v.t - t0) / DAY, y: v.y }));
    const slope = points.length >= 3 ? linregSlope(points) : null; // value/day
    const meanY = points.length ? points.reduce((s, p) => s + p.y, 0) / points.length : 0;
    const relSlopeWk = slope !== null && meanY > 0 ? (slope * 7) / meanY : null; // 週あたり相対変化
    let trend = 'insufficient';
    if (points.length >= 3 && relSlopeWk !== null) {
      if (relSlopeWk > 0.02) trend = 'improving';
      else if (relSlopeWk < -0.02) trend = 'declining';
      else trend = 'plateau';
    } else if (points.length > 0) {
      trend = 'new';
    }
    // パーセンタイル（同種目の全員ベスト中の位置）
    const sorted = bestSortedByEx.get(key) || [];
    const percentile = percentileRank(sorted, pe.best);
    // 今週のPB更新数
    const sortedT = ordered;
    let runningMax = -Infinity;
    for (const v of sortedT) {
      const isPB = v.y > runningMax;
      runningMax = Math.max(runningMax, v.y);
      if (isPB && v.t !== null && exportTime - v.t < 7 * DAY && a.perExercise.get(key).count > 1) {
        // 初投稿はPBに数えない（2回目以降の更新のみ）
        if (sortedT.indexOf(v) > 0) pbThisWeek += 1;
      }
    }

    perExercise.push({
      key,
      name: ex?.name || key,
      tags: ex?.tags || [],
      count: pe.count,
      best: pe.best === -Infinity ? null : pe.best,
      firstValue,
      lastValue,
      growthPct:
        firstValue && firstValue > 0 && lastValue !== null
          ? round(((lastValue - firstValue) / firstValue) * 100, 1)
          : null,
      slopePerWeek: slope !== null ? round(slope * 7, 3) : null,
      relSlopeWeekPct: relSlopeWk !== null ? round(relSlopeWk * 100, 1) : null,
      trend,
      percentile,
    });

    for (const tg of ex?.tags || []) {
      if (percentile !== null) {
        if (!userTagPercentiles.has(tg)) userTagPercentiles.set(tg, []);
        userTagPercentiles.get(tg).push(percentile);
      }
    }
  }
  a.pbThisWeek = pbThisWeek;

  // タグ別強み（平均パーセンタイル）
  const tagStrength = {};
  for (const [tg, arr] of userTagPercentiles) {
    tagStrength[tg] = round(arr.reduce((s, x) => s + x, 0) / arr.length, 1);
  }
  const tagVals = Object.values(tagStrength);
  const overallSkill =
    tagVals.length > 0 ? round(tagVals.reduce((s, x) => s + x, 0) / tagVals.length, 1) : null;
  const tagSpread =
    tagVals.length >= 2 ? round(Math.max(...tagVals) - Math.min(...tagVals), 1) : null;

  // 強み / 弱み
  const ranked = perExercise
    .filter((e) => e.percentile !== null)
    .sort((x, y) => y.percentile - x.percentile);
  const strengths = ranked.slice(0, 3);
  const strengthKeys = new Set(strengths.map((e) => e.key));
  // 苦手は得意と重複させない（種目数が少ない人は空＝「苦手と呼べる種目なし」）
  const weaknesses = ranked
    .filter((e) => !strengthKeys.has(e.key))
    .slice(-3)
    .reverse();

  // 成長スター / 停滞
  const improving = perExercise
    .filter((e) => e.trend === 'improving' && e.relSlopeWeekPct !== null)
    .sort((x, y) => y.relSlopeWeekPct - x.relSlopeWeekPct);
  const plateaus = perExercise.filter((e) => e.trend === 'plateau' || e.trend === 'declining');
  const avgRelSlope =
    improving.length + plateaus.length > 0
      ? round(
          perExercise
            .filter((e) => e.relSlopeWeekPct !== null)
            .reduce((s, e) => s + e.relSlopeWeekPct, 0) /
            Math.max(1, perExercise.filter((e) => e.relSlopeWeekPct !== null).length),
          1
        )
      : null;

  // 未開拓タグ（カタログにあるが、その人が一度も投稿していないタグ）
  const doneTags = new Set();
  for (const e of perExercise) for (const tg of e.tags) doneTags.add(tg);
  const neglectedTags = [...allTags]
    .filter((tg) => !doneTags.has(tg))
    .sort((x, y) => (tagExerciseCount.get(y) || 0) - (tagExerciseCount.get(x) || 0));

  users.push({
    uid: a.uid,
    userName: a.userName,
    isGuest: a.isGuest,
    totalPosts: a.totalPosts,
    activeDays: a.activeDates.size,
    postsThisWeek: a.postsThisWeek,
    pbThisWeek: a.pbThisWeek,
    firstPost: a.firstPost ? new Date(a.firstPost).toISOString() : null,
    lastPost: a.lastPost ? new Date(a.lastPost).toISOString() : null,
    currentStreak: st.current,
    longestStreak: st.longest,
    weekday: a.weekday,
    hour: a.hour,
    social: {
      likesGiven: a.likesGiven,
      likesReceived: a.likesReceived,
      commentsGiven: a.commentsGiven,
      commentsReceived: a.commentsReceived,
    },
    creator: a.creator,
    overallSkill,
    tagStrength,
    tagSpread,
    avgRelSlopeWeekPct: avgRelSlope,
    perExercise: perExercise.sort((x, y) => y.count - x.count),
    strengths,
    weaknesses,
    growthStars: improving.slice(0, 3),
    plateaus: plateaus.slice(0, 3),
    neglectedTags: neglectedTags.slice(0, 5),
    badges: [], // 後で付与
    type: null,
  });
}

// 活動者のみ（バッジ/ランキング対象）
const active = users.filter((u) => u.totalPosts > 0);

// ====================================================================
// ペルソナ / 二つ名（各指標の #1 に称号付与）
// ====================================================================
function topUser(arr, fn, label, desc, minVal = 0) {
  let best = null;
  for (const u of arr) {
    const v = fn(u);
    if (v === null || v === undefined) continue;
    if (v <= minVal) continue;
    if (best === null || v > best.v) best = { u, v };
  }
  if (best) {
    best.u.badges.push({ label, desc, value: round(best.v, 1) });
  }
  return best;
}

topUser(active, (u) => u.totalPosts, '投稿王', '総投稿数トップ');
topUser(active, (u) => u.longestStreak, '継続の鬼', '最長連続投稿日数トップ', 1);
topUser(active, (u) => u.social.likesGiven, 'いいね職人', '一番たくさん応援した人');
topUser(active, (u) => u.social.likesReceived, '人気者', '一番いいねを集めた人');
topUser(active, (u) => u.social.commentsGiven, 'コメント番長', 'コメントで一番盛り上げた人');
topUser(active, (u) => u.avgRelSlopeWeekPct, '急成長株', '平均成長率トップ');
topUser(active, (u) => u.creator.createdCount, '種目クリエイター', '自作種目数トップ', 0);
topUser(
  active.filter((u) => u.creator.avgRating !== null && u.creator.ratedCount > 0),
  (u) => u.creator.avgRating,
  '神種目メーカー',
  '自作種目の平均評価トップ'
);

// 万能型 / 一点特化型（タグが3つ以上あるユーザー）
const multiTag = active.filter((u) => Object.keys(u.tagStrength).length >= 3 && u.tagSpread !== null);
if (multiTag.length) {
  const allRounder = multiTag.reduce((a, b) => (b.tagSpread < a.tagSpread ? b : a));
  allRounder.badges.push({ label: '万能型', desc: 'タグ間の得意・不得意の差が最も小さい' });
  const specialist = multiTag.reduce((a, b) => (b.tagSpread > a.tagSpread ? b : a));
  specialist.badges.push({ label: '一点特化型', desc: '特定タグに尖った強みを持つ' });
}

// 三日坊主王（投稿はあるが活動日が極端に少ない／空白が長い）
for (const u of active) {
  if (u.activeDays >= 2 && u.totalPosts >= 3 && u.activeDays / u.totalPosts < 0.5 && u.currentStreak === 0) {
    // 投稿は固まっているが今は止まっている人だけ候補（控えめに）
  }
}

// 朝型 / 夜型
for (const u of active) {
  const total = u.hour.reduce((s, x) => s + x, 0);
  if (total < 5) continue;
  const morning = u.hour.slice(5, 11).reduce((s, x) => s + x, 0);
  const night = u.hour.slice(20, 24).reduce((s, x) => s + x, 0) + u.hour.slice(0, 3).reduce((s, x) => s + x, 0);
  if (morning / total > 0.5) u.badges.push({ label: '朝型', desc: '朝に投稿が集中' });
  else if (night / total > 0.5) u.badges.push({ label: '夜型', desc: '夜・深夜に投稿が集中' });
}

// type 判定
for (const u of active) {
  if (u.badges.find((b) => b.label === '万能型')) u.type = '万能型';
  else if (u.badges.find((b) => b.label === '一点特化型')) u.type = '一点特化型';
  else u.type = 'バランス型';
}

// ====================================================================
// 種目別 / タグ別 集計
// ====================================================================
const exercisesOut = ds.exercises.map((e) => {
  const userBest = bestByExUser.get(e.key) || new Map();
  const postsOfEx = ds.posts.filter((p) => p.exerciseKey === e.key);
  let recent7 = 0;
  let prev7 = 0;
  for (const p of postsOfEx) {
    const t = tsMs(p.timestamp);
    if (t === null) continue;
    const age = exportTime - t;
    if (age < 7 * DAY) recent7 += 1;
    else if (age < 14 * DAY) prev7 += 1;
  }
  const leaderboard = [...userBest.entries()]
    .map(([uid, best]) => ({ user: nameOf(uid), uid, best }))
    .sort((a, b) => b.best - a.best)
    .slice(0, 5);
  return {
    key: e.key,
    name: e.name,
    rule: e.rule,
    tags: e.tags,
    createdByName: e.createdByName,
    rating: e.rating,
    totalPosts: postsOfEx.length,
    uniqueUsers: userBest.size,
    recent7,
    prev7,
    momentum: recent7 - prev7,
    topUser: leaderboard[0]?.user || null,
    leaderboard,
  };
});

const tagsOut = [...allTags]
  .map((tg) => {
    const exs = ds.exercises.filter((e) => e.tags.includes(tg));
    const exKeys = new Set(exs.map((e) => e.key));
    const postCount = ds.posts.filter((p) => exKeys.has(p.exerciseKey)).length;
    // タグ王 = そのタグの平均パーセンタイルが最も高い人
    let king = null;
    for (const u of active) {
      const v = u.tagStrength[tg];
      if (v === undefined) continue;
      if (king === null || v > king.v) king = { user: u.userName, v };
    }
    return {
      tag: tg,
      exerciseCount: exs.length,
      postCount,
      king: king ? { user: king.user, score: king.v } : null,
    };
  })
  .sort((a, b) => b.postCount - a.postCount);

// ====================================================================
// ライバル（僅差対決）
// ====================================================================
const rivalries = [];
for (const [key, m] of bestByExUser) {
  if (m.size < 2) continue;
  const ranked = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const [u1, v1] = ranked[0];
  const [u2, v2] = ranked[1];
  if (v1 <= 0) continue;
  const gapPct = round(((v1 - v2) / v1) * 100, 1);
  if (gapPct <= 15) {
    rivalries.push({
      exerciseKey: key,
      exercise: exByKey.get(key)?.name || key,
      leader: nameOf(u1),
      leaderValue: v1,
      challenger: nameOf(u2),
      challengerValue: v2,
      gapPct,
    });
  }
}
rivalries.sort((a, b) => a.gapPct - b.gapPct);

// ====================================================================
// 今週のサマリー / MVP
// ====================================================================
const postsThisWeek = ds.posts.filter((p) => {
  const t = tsMs(p.timestamp);
  return t !== null && exportTime - t < 7 * DAY;
});
const activeUsersThisWeek = new Set(postsThisWeek.map((p) => p.uid)).size;
const exCountThisWeek = {};
for (const p of postsThisWeek) exCountThisWeek[p.exerciseKey] = (exCountThisWeek[p.exerciseKey] || 0) + 1;
const hottestKey = Object.entries(exCountThisWeek).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

const mvpCand = [...active].sort(
  (a, b) => b.pbThisWeek - a.pbThisWeek || b.postsThisWeek - a.postsThisWeek
);
const mvp = mvpCand[0] && (mvpCand[0].pbThisWeek > 0 || mvpCand[0].postsThisWeek > 0)
  ? {
      userName: mvpCand[0].userName,
      pbThisWeek: mvpCand[0].pbThisWeek,
      postsThisWeek: mvpCand[0].postsThisWeek,
    }
  : null;

const summary = {
  exportDate: ds.meta?.exportDate || dateStr,
  totalUsers: ds.users.length,
  activeUsers: active.length,
  totalExercises: ds.exercises.length,
  totalPosts: ds.posts.length,
  postsThisWeek: postsThisWeek.length,
  activeUsersThisWeek,
  hottestExercise: hottestKey ? exByKey.get(hottestKey)?.name || hottestKey : null,
  mvp,
};

// ====================================================================
// 週間チャレンジ / 月間ダービー / チャレンジ外 / 評価交流（本体ロジック再現）
// ====================================================================
const challenge = buildChallengeSections(ds, exByKey, nameOf);

// ====================================================================
// digest 組み立て & 出力
// ====================================================================
const digest = {
  meta: {
    generatedAt: new Date().toISOString(),
    exportDate: ds.meta?.exportDate || dateStr,
    projectId: ds.meta?.projectId || null,
    note:
      'パーセンタイルは同一種目の全員ベスト値中の相対位置。slope/相対成長率は value の時系列単回帰（3投稿以上）。' +
      'weeklyChallenge/monthlyDerby は本体と同じ得点ロジック（平日・今週の3種目、通常=self/max×100、バーバリアン=min/self×100、合計）。',
  },
  summary,
  // ▼ 主役: 週間チャレンジ & 月間ダービー（優勝争い）
  weeklyChallenge: challenge.weeklyChallenge,
  monthlyDerby: challenge.monthlyDerby,
  offChallenge: challenge.offChallenge,
  nextWeekForecast: challenge.nextWeekForecast,
  ratingScene: challenge.ratingScene,
  // ▼ 補足: フリーモード全体の実力・成長・キャラ付け
  users: users.sort((a, b) => b.totalPosts - a.totalPosts),
  exercises: exercisesOut.sort((a, b) => b.totalPosts - a.totalPosts),
  tags: tagsOut,
  rivalries: rivalries.slice(0, 10),
  allTags: [...allTags].sort(),
};

writeFileSync(join(outDir, 'digest.json'), JSON.stringify(digest, null, 2), 'utf8');
writeFileSync(
  join(outDir, 'posts.flat.jsonl'),
  flat.map((r) => JSON.stringify(r)).join('\n'),
  'utf8'
);

// ダッシュボード生成（テンプレートに digest を埋め込んだ自己完結HTML）
const tplPath = join(__dirname, 'dashboard.template.html');
if (existsSync(tplPath)) {
  const tpl = readFileSync(tplPath, 'utf8');
  const html = tpl.replace('"__DIGEST_JSON__"', JSON.stringify(digest));
  writeFileSync(join(outDir, 'dashboard.html'), html, 'utf8');
}

console.log(
  `[digest] 完了: ${outDir}\n` +
    `  users(active)=${active.length}, exercises=${exercisesOut.length}, tags=${tagsOut.length}, rivalries=${rivalries.length}\n` +
    `  → digest.json / posts.flat.jsonl / dashboard.html`
);
