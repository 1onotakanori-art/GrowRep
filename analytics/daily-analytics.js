/**
 * デイリーミッションの週次集計（digest.dailyMission）
 * --------------------------------------------------------------
 * アプリが settings_free/daily_mission の history.<日付キー> に残した
 * 「その日の種目・ピーク」を正として、対象週（月〜日, JST 暦日）の
 * 各人の目標・合計・クリアを決定論的に再現する。
 *
 * - 目標回数・確率は web/src/lib/daily-mission.ts の純粋関数をそのまま移植したもの。
 *   ⚠️ シード文字列・分布定数・丸めを変えないこと（アプリの表示とずれる）。
 *   一致は daily-analytics.test.js の固定値で確かめている。
 * - 参加者は「その日 posts_free に1件以上投稿した人」。アプリはその日ログインした人
 *   （users.lastActiveDateKey）を並べるが、最後に開いた日しか残らないので後から数え直せない。
 * - history に無い日は推測で埋めず、missingDays に出すだけにする。
 *
 * 数値はここで確定させ、Cowork には解釈・物語化だけを任せる。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const DOW = ['日', '月', '火', '水', '木', '金', '土'];

// ---------------------------------------------------------------------
// web/src/lib/daily-mission.ts からの移植（値を変えないこと）
// ---------------------------------------------------------------------
export const DAILY_SIGMA_LOW = 0.34;
export const DAILY_SIGMA_HIGH = 0.26;
export const DAILY_MIN_RATIO = 0.45;
export const DAILY_MAX_RATIO = 2.0;
export const DAILY_REPS_FLOOR = 5;
export const DAILY_REPS_DEFAULT_PEAK = 30;
export const DAILY_PEAK_BEST_RATIO = 1.0;
const DAILY_LOW_WEIGHT = DAILY_SIGMA_LOW / (DAILY_SIGMA_LOW + DAILY_SIGMA_HIGH);

export function hashStringToSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededNormal(rand) {
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function resolveDailyPeak(bestValue) {
  const best = Number(bestValue) || 0;
  if (best <= 0) return DAILY_REPS_DEFAULT_PEAK;
  return Math.max(DAILY_REPS_FLOOR, Math.round(best * DAILY_PEAK_BEST_RATIO));
}

function dailyLogCenter(peak) {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  return Math.log(p) + DAILY_SIGMA_LOW * DAILY_SIGMA_LOW;
}

function dailyRepsBounds(peak) {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const min = Math.max(DAILY_REPS_FLOOR, Math.round(p * DAILY_MIN_RATIO));
  const max = Math.max(min + 1, Math.round(p * DAILY_MAX_RATIO));
  return { min, max };
}

export function generateDailyMissionTarget(userId, dateKey, exerciseKey, peak = DAILY_REPS_DEFAULT_PEAK, zone = null) {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const rand = createSeededRandom(hashStringToSeed(`daily-reps|${userId}|${dateKey}|${exerciseKey}`));
  const { min, max } = dailyRepsBounds(p);
  // 今日の領域の中だけから引く（領域の累積確率の幅を一様に引いて逆算）
  if (zone != null) {
    const edges = dailyZoneEdges(p);
    const ca = dailyTargetCdf(edges[zone], p);
    const cb = dailyTargetCdf(edges[zone + 1], p);
    const u = ca + rand() * (cb - ca);
    return Math.min(max, Math.max(min, Math.round(dailyTargetQuantile(u, p))));
  }
  const center = dailyLogCenter(p);
  const side = rand();
  const z = Math.abs(seededNormal(rand));
  const y = side < DAILY_LOW_WEIGHT ? center - DAILY_SIGMA_LOW * z : center + DAILY_SIGMA_HIGH * z;
  return Math.min(max, Math.max(min, Math.round(Math.exp(y))));
}

// ---- 7つの領域（月〜日で1つずつ消化。2026-11-09 から） ----
// 左端〜ピークを3等分・ピーク〜右端を4等分。毎日、残りから面積比で1つ引き、
// クリアなら引いた領域・未クリアなら残りの一番軽い領域が消える。レイド日は何もしない。
export const DAILY_ZONE_LOW_COUNT = 3;
export const DAILY_ZONE_HIGH_COUNT = 4;
export const DAILY_ZONE_COUNT = DAILY_ZONE_LOW_COUNT + DAILY_ZONE_HIGH_COUNT;
export const DAILY_ZONE_START_DATE_KEY = '2026-11-09';
const DAILY_ZONE_WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

function dateKeyDayOfWeek(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function dailyTargetQuantile(u, peak) {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const center = dailyLogCenter(p);
  let lo = center - 8;
  let hi = center + 8;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (dailyTargetCdf(Math.exp(mid), p) < u) lo = mid;
    else hi = mid;
  }
  return Math.exp((lo + hi) / 2);
}

export function dailyZoneEdges(peak) {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const { min, max } = dailyRepsBounds(p);
  const mid = Math.min(max, Math.max(min, p));
  const edges = [];
  for (let k = 0; k <= DAILY_ZONE_LOW_COUNT; k++) edges.push(min + ((mid - min) * k) / DAILY_ZONE_LOW_COUNT);
  for (let k = 1; k <= DAILY_ZONE_HIGH_COUNT; k++) edges.push(mid + ((max - mid) * k) / DAILY_ZONE_HIGH_COUNT);
  return edges;
}

function dailyZoneMass(zone, peak) {
  const edges = dailyZoneEdges(peak);
  return Math.max(0, dailyTargetCdf(edges[zone + 1], peak) - dailyTargetCdf(edges[zone], peak));
}

function dailyZoneDrawWeights(pool, peak) {
  const masses = pool.map((z) => dailyZoneMass(z, peak));
  const total = masses.reduce((s, m) => s + m, 0);
  if (!(total > 0)) return pool.map(() => 1 / pool.length);
  return masses.map((m) => m / total);
}

export function pickDailyZone(userId, dateKey, pool, peak) {
  if (pool.length === 0) return null;
  const r = createSeededRandom(hashStringToSeed(`daily-zone|${userId}|${dateKey}`))();
  const weights = dailyZoneDrawWeights(pool, peak);
  let acc = 0;
  for (let i = 0; i < pool.length; i++) {
    acc += weights[i];
    if (r < acc) return pool[i];
  }
  for (let i = pool.length - 1; i >= 0; i--) if (weights[i] > 0) return pool[i];
  return pool[pool.length - 1];
}

function settleDailyZoneDay(pool, zone, cleared) {
  if (pool.length === 0) return { pool, removed: null, removedBy: null };
  const clearedZone = cleared && zone != null && pool.includes(zone);
  const removed = clearedZone ? zone : Math.min(...pool);
  return { pool: pool.filter((z) => z !== removed), removed, removedBy: clearedZone ? 'clear' : 'skip' };
}

/** 週の初めから順に、その人の領域の消化をたどる。web: replayDailyZoneWeek */
export function replayDailyZoneWeek(userId, days, totalsByDay) {
  let pool = Array.from({ length: DAILY_ZONE_COUNT }, (_, i) => i);
  const results = [];
  [...days]
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0))
    .forEach((day) => {
      const weekday = DAILY_ZONE_WEEKDAYS[(dateKeyDayOfWeek(day.dateKey) + 6) % 7];
      const total = (totalsByDay[day.dateKey] || {})[userId] || 0;
      const before = pool;
      if (day.kind === 'paused') {
        results.push({ dateKey: day.dateKey, weekday, kind: day.kind, pool: before, zone: null, target: null, total, cleared: false, removed: null, removedBy: null });
        return;
      }
      let zone = null;
      let target = null;
      if (day.kind === 'normal' && day.exerciseKey) {
        const peak = day.peak && day.peak > 0 ? day.peak : DAILY_REPS_DEFAULT_PEAK;
        zone = pickDailyZone(userId, day.dateKey, pool, peak);
        if (zone != null) target = generateDailyMissionTarget(userId, day.dateKey, day.exerciseKey, peak, zone);
      }
      const cleared = target != null && total >= target;
      const settled = settleDailyZoneDay(pool, zone, cleared);
      pool = settled.pool;
      results.push({ dateKey: day.dateKey, weekday, kind: day.kind, pool: before, zone, target, total, cleared, removed: settled.removed, removedBy: settled.removedBy });
    });
  return { days: results, pool };
}

/** history.<日付キー> → 消化の材料（記録無し=missed / レイド=paused）。web: dailyZoneDayFromHistory */
export function dailyZoneDayFromHistory(dateKey, entry) {
  if (!entry || typeof entry !== 'object') return { dateKey, kind: 'missed' };
  if (typeof entry.raidDay === 'number') return { dateKey, kind: 'paused' };
  if (typeof entry.exerciseKey !== 'string' || !entry.exerciseKey) return { dateKey, kind: 'missed' };
  const peak = typeof entry.peak === 'number' && entry.peak > 0 ? entry.peak : null;
  return { dateKey, kind: 'normal', exerciseKey: entry.exerciseKey, peak };
}

function standardNormalCdf(z) {
  const sign = z < 0 ? -1 : 1;
  const a = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * a);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1 - poly * Math.exp(-a * a);
  return 0.5 * (1 + sign * erf);
}

function dailyTargetCdf(x, peak) {
  if (!(x > 0)) return 0;
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const d = Math.log(x) - dailyLogCenter(p);
  if (d <= 0) return 2 * DAILY_LOW_WEIGHT * standardNormalCdf(d / DAILY_SIGMA_LOW);
  return DAILY_LOW_WEIGHT + 2 * (1 - DAILY_LOW_WEIGHT) * (standardNormalCdf(d / DAILY_SIGMA_HIGH) - 0.5);
}

export function dailyTargetProbability(target, peak, zone = null) {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const { min, max } = dailyRepsBounds(p);
  if (zone != null) {
    // その人の今日の領域の中で、その回数を引く確率（アプリの表示と同じ）
    const edges = dailyZoneEdges(p);
    const a = dailyTargetCdf(edges[zone], p);
    const b = dailyTargetCdf(edges[zone + 1], p);
    if (!(b > a)) {
      const only = Math.min(max, Math.max(min, Math.round(edges[zone])));
      return target === only ? 1 : 0;
    }
    const lo = dailyTargetCdf(target - 0.5, p);
    const hi = dailyTargetCdf(target + 0.5, p);
    return Math.min(1, Math.max(0, (Math.min(hi, b) - Math.max(lo, a)) / (b - a)));
  }
  let prob;
  if (target <= min) prob = dailyTargetCdf(min + 0.5, p);
  else if (target >= max) prob = 1 - dailyTargetCdf(max - 0.5, p);
  else prob = dailyTargetCdf(target + 0.5, p) - dailyTargetCdf(target - 0.5, p);
  return Math.min(1, Math.max(0, prob));
}

/**
 * その目標回数「以上」を引く確率（0〜1）。目標の重さの物差し。
 * アプリの確率（dailyTargetProbability）は「その回数ぴったり」を引く確率なので、
 * ピークが大きい種目ではどの回数も1%前後になり、重さの比較には使えない。
 * 抽選の下限に丸め込まれる目標は 1（誰でも引きうる軽さ）。
 */
export function dailyTargetTopShare(target, peak) {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const { min } = dailyRepsBounds(p);
  if (target <= min) return 1;
  return Math.min(1, Math.max(0, 1 - dailyTargetCdf(target - 0.5, p)));
}

export function formatDailyProbability(probability) {
  const pct = (Number(probability) || 0) * 100;
  if (pct <= 0) return '0%';
  if (pct < 0.1) return '<0.1%';
  return `${pct.toFixed(1)}%`;
}

// ---------------------------------------------------------------------
// 日付まわり（JST 暦日）
// ---------------------------------------------------------------------

/** UTC ms → JST の日付キー */
export function dateKeyJST(ms) {
  const j = new Date(ms + JST_OFFSET_MS);
  return `${j.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, '0')}-${String(j.getUTCDate()).padStart(2, '0')}`;
}

/** 日付キー → その日の 0:00 JST（UTC ms） */
export function dayStartMs(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d) - JST_OFFSET_MS;
}

export function shiftDateKey(dateKey, days) {
  return dateKeyJST(dayStartMs(dateKey) + days * DAY);
}

function dowOf(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * 対象週（月〜日）。export 日以前で最も新しい日曜で終わる週。
 * 日曜夕方の export ならその日曜で終わる週（日曜は途中＝inProgress）、
 * 月曜以降に遅れて回しても、終わったばかりの週を指す。
 */
export function resolveDailyPeriod(exportedAtMs) {
  const today = dateKeyJST(exportedAtMs);
  const back = dowOf(today); // 日曜=0 → 0日戻る、月曜=1 → 1日戻る…
  const to = shiftDateKey(today, -back);
  const from = shiftDateKey(to, -6);
  return { from, to };
}

function round(n, p = 2) {
  if (n === null || n === undefined || !isFinite(n)) return null;
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

function tsMs(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

// ---------------------------------------------------------------------
// 集計本体
// ---------------------------------------------------------------------

/** 「鬼目標」とみなす重さ（その回数以上を引く確率）の上限＝上位10% */
export const RARE_TOP_SHARE = 0.1;
/** 「あと少し」とみなす達成率の下限 */
export const NEAR_MISS_RATIO = 0.8;
/** 「やり過ぎ」とみなす達成率の下限 */
export const OVERKILL_RATIO = 1.5;
const HIGHLIGHT_MAX = 3;

/**
 * @param {object} ds dataset.json
 * @param {object} ctx { exByKey: Map, nameOf: (uid)=>string, challengeKeys?: string[] | ((period)=>string[]|null) | null }
 *   challengeKeys = 対象週の週間チャレンジ種目（関門と本戦の関係 gate に使う。無ければ gate は null）。
 *   対象週が決まってから選びたいときは period を受け取る関数で渡す。
 * @returns digest.dailyMission（history のある日が1日も無ければ null）
 */
export function buildDailyMissionDigest(ds, { exByKey, nameOf, challengeKeys: challengeKeysArg = null }) {
  const nowMs = tsMs(ds.meta?.exportedAt) || Date.now();
  const history = (ds.dailyMission && ds.dailyMission.history) || {};
  const period = resolveDailyPeriod(nowMs);
  const challengeKeys = typeof challengeKeysArg === 'function' ? challengeKeysArg(period) : challengeKeysArg;
  const dateKeys = Array.from({ length: 7 }, (_, i) => shiftDateKey(period.from, i));

  const posts = (ds.posts || [])
    .map((p) => ({ uid: p.uid, key: p.exerciseKey, value: Number(p.value) || 0, t: tsMs(p.timestamp) }))
    .filter((p) => p.uid && p.t !== null);

  // ---- 7つの領域：一人ひとりの週の消化をたどる（アプリと同じ材料・同じ順序） ----
  // その日のピークは記録があればそれ、無ければ当日 0:00 より前の全投稿の最大から（下の日ごとの集計と同じ）
  const peakOfDay = (dateKey, entry) => {
    if (typeof entry.peak === 'number' && entry.peak > 0) return { peak: entry.peak, source: 'history' };
    const start = dayStartMs(dateKey);
    const best = posts
      .filter((p) => p.key === entry.exerciseKey && p.t < start)
      .reduce((m, p) => Math.max(m, p.value), 0);
    return { peak: resolveDailyPeak(best), source: 'recomputed' };
  };
  const zoneInputs = [];
  const zoneTotals = {};
  if (dateKeys[0] >= DAILY_ZONE_START_DATE_KEY) {
    for (const dateKey of dateKeys) {
      const start = dayStartMs(dateKey);
      if (start > nowMs) break;
      const day = dailyZoneDayFromHistory(dateKey, history[dateKey]);
      if (day.kind === 'normal') {
        day.peak = peakOfDay(dateKey, history[dateKey]).peak;
        const t = {};
        posts.forEach((p) => {
          if (p.t < start || p.t >= start + DAY || p.key !== day.exerciseKey || p.value <= 0) return;
          t[p.uid] = (t[p.uid] || 0) + p.value;
        });
        zoneTotals[dateKey] = t;
      }
      zoneInputs.push(day);
    }
  }
  const zoneCache = new Map();
  /** uid → 日付キー → その日に引いた領域（0〜6）。領域導入前の週は空 */
  const zonesOf = (uid) => {
    if (!zoneCache.has(uid)) {
      const byDate = {};
      if (zoneInputs.length > 0) {
        replayDailyZoneWeek(uid, zoneInputs, zoneTotals).days.forEach((d) => (byDate[d.dateKey] = d.zone));
      }
      zoneCache.set(uid, byDate);
    }
    return zoneCache.get(uid);
  };

  const days = [];
  const missingDays = [];

  for (const dateKey of dateKeys) {
    const entry = history[dateKey];
    const start = dayStartMs(dateKey);
    const end = start + DAY;
    if (start > nowMs) continue; // まだ来ていない日
    if (!entry || !entry.exerciseKey) {
      missingDays.push(dateKey);
      continue;
    }
    const key = entry.exerciseKey;
    const dow = dowOf(dateKey);
    const inProgress = end > nowMs;
    const dayPosts = posts.filter((p) => p.t >= start && p.t < end);
    const activeUids = [...new Set(dayPosts.map((p) => p.uid))].sort();
    const totals = {};
    dayPosts.forEach((p) => {
      if (p.key !== key || p.value <= 0) return;
      totals[p.uid] = (totals[p.uid] || 0) + p.value;
    });

    const base = {
      dateKey,
      weekdayLabel: DOW[dow],
      isWeekday: dow >= 1 && dow <= 5,
      inProgress,
      exerciseKey: key,
      exerciseName: exByKey.get(key)?.name || key,
      rerolled: Array.isArray(entry.rerolledFrom) && entry.rerolledFrom.length > 0,
      activeCount: activeUids.length,
    };

    // レイド日: 個人目標は無く、全員の合計で挑む協力戦
    if (entry.raidDay != null) {
      const contributors = activeUids
        .map((uid) => ({ userName: nameOf(uid), value: totals[uid] || 0 }))
        .sort((a, b) => b.value - a.value || a.userName.localeCompare(b.userName));
      const teamTotal = contributors.reduce((s, c) => s + c.value, 0);
      const goal = typeof entry.raidGoal === 'number' ? entry.raidGoal : null;
      days.push({
        ...base,
        peak: null,
        raid: {
          day: entry.raidDay,
          goal,
          teamTotal,
          cleared: goal == null ? null : teamTotal >= goal,
          contributors,
        },
        clearedCount: null,
        participants: [],
      });
      continue;
    }

    // ピーク: 記録があればそれ。未集計（引き直し直後など）なら当日 0:00 より前の全投稿の最大から再計算
    const { peak, source: peakSource } = peakOfDay(dateKey, entry);

    const participants = activeUids
      .map((uid) => {
        const zone = zonesOf(uid)[dateKey] ?? null;
        const target = generateDailyMissionTarget(uid, dateKey, key, peak, zone);
        const probability = dailyTargetProbability(target, peak, zone);
        const topShare = dailyTargetTopShare(target, peak);
        const totalValue = totals[uid] || 0;
        const cleared = totalValue >= target;
        return {
          uid,
          userName: nameOf(uid),
          target,
          // その日に引いた領域（1〜7、軽い順）。導入前は null
          zone: zone == null ? null : zone + 1,
          probability: round(probability, 4),
          probabilityPct: formatDailyProbability(probability),
          topShare: round(topShare, 4),
          topPct: formatDailyProbability(topShare),
          totalValue,
          cleared,
          ratio: round(totalValue / target, 2),
          status: cleared ? 'cleared' : totalValue > 0 ? 'short' : 'untouched',
        };
      })
      .sort((a, b) => a.target - b.target || a.userName.localeCompare(b.userName));

    days.push({
      ...base,
      peak,
      peakSource,
      raid: null,
      clearedCount: participants.filter((p) => p.cleared).length,
      participants,
    });
  }

  if (days.length === 0) return null;

  // ---- 週の通算（終わった通常日だけ） ----
  const finished = days.filter((d) => !d.inProgress && !d.raid);
  const finishedWeekdays = finished.filter((d) => d.isWeekday);
  const userMap = new Map();
  for (const d of finished) {
    for (const p of d.participants) {
      if (!userMap.has(p.uid)) {
        userMap.set(p.uid, {
          uid: p.uid,
          userName: p.userName,
          activeDays: 0,
          attemptDays: 0,
          clearDays: 0,
          weekdayClearDays: 0,
        });
      }
      const u = userMap.get(p.uid);
      u.activeDays++;
      if (p.totalValue > 0) u.attemptDays++;
      if (p.cleared) {
        u.clearDays++;
        if (d.isWeekday) u.weekdayClearDays++;
      }
    }
  }
  // 連続クリア: 終わった日を日付順に見て、クリアが途切れず続いた最長日数。
  // history の無い日・レイド日はそこで途切れる扱い（判定できないため）。
  const orderedKeys = dateKeys.filter((k) => dayStartMs(k) + DAY <= nowMs);
  for (const u of userMap.values()) {
    let run = 0;
    let best = 0;
    for (const k of orderedKeys) {
      const d = finished.find((x) => x.dateKey === k);
      const p = d && d.participants.find((x) => x.uid === u.uid);
      if (p && p.cleared) {
        run++;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    }
    u.clearStreak = best;
    u.allWeekdaysCleared = finishedWeekdays.length > 0 && u.weekdayClearDays === finishedWeekdays.length;
  }
  const perUser = [...userMap.values()]
    .sort(
      (a, b) =>
        b.weekdayClearDays - a.weekdayClearDays ||
        b.clearDays - a.clearDays ||
        b.clearStreak - a.clearStreak ||
        a.userName.localeCompare(b.userName)
    )
    .map(({ uid, ...rest }) => rest);

  // ---- 名場面 ----
  const flatP = finished.flatMap((d) =>
    d.participants.map((p) => ({ ...p, dateKey: d.dateKey, weekdayLabel: d.weekdayLabel, exerciseName: d.exerciseName }))
  );
  const pick = ({ userName, dateKey, weekdayLabel, exerciseName, target, totalValue }) => ({
    userName,
    dateKey,
    weekdayLabel,
    exerciseName,
    target,
    totalValue,
  });
  const highlights = {
    rareClears: flatP
      .filter((p) => p.cleared && p.topShare <= RARE_TOP_SHARE)
      .sort((a, b) => a.topShare - b.topShare)
      .slice(0, HIGHLIGHT_MAX)
      .map((p) => ({ ...pick(p), topShare: p.topShare, topPct: p.topPct })),
    nearMisses: flatP
      .filter((p) => !p.cleared && p.totalValue > 0 && p.ratio >= NEAR_MISS_RATIO)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, HIGHLIGHT_MAX)
      .map((p) => ({ ...pick(p), short: p.target - p.totalValue })),
    overkills: flatP
      .filter((p) => p.cleared && p.ratio >= OVERKILL_RATIO)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, HIGHLIGHT_MAX)
      .map((p) => ({ ...pick(p), ratio: p.ratio })),
    allClearDays: finished
      .filter((d) => d.activeCount >= 2 && d.clearedCount === d.participants.length)
      .map((d) => d.dateKey),
  };

  // ---- 関門と本戦（平日にデイリーを突破した日数 vs 本戦種目に投稿した日数） ----
  let gate = null;
  if (Array.isArray(challengeKeys) && challengeKeys.length > 0) {
    const keySet = new Set(challengeKeys);
    gate = [...userMap.values()].map((u) => {
      const weeklyPostDays = finishedWeekdays.filter((d) => {
        const start = dayStartMs(d.dateKey);
        return posts.some((p) => p.uid === u.uid && keySet.has(p.key) && p.t >= start && p.t < start + DAY);
      }).length;
      return { userName: u.userName, weekdayClearDays: u.weekdayClearDays, weeklyPostDays };
    });
    gate.sort((a, b) => b.weekdayClearDays - a.weekdayClearDays || a.userName.localeCompare(b.userName));
  }

  // 出力から uid を落とす（週報には名前だけで足りる）
  const daysOut = days.map((d) => ({
    ...d,
    participants: d.participants.map(({ uid, ...rest }) => rest),
  }));

  return {
    period,
    source: 'history',
    finishedDays: finished.length,
    finishedWeekdays: finishedWeekdays.length,
    missingDays,
    days: daysOut,
    perUser,
    highlights,
    gate,
    note:
      '目標回数はアプリと同じ抽選の再現（ユーザー×日付×種目のシード）。参加者はその日フリーに1件以上投稿した人。' +
      'topPct=その回数以上を引く確率（上位何%の重い目標か。小さいほど重い）。probabilityPct=その回数ぴったりを引く確率（アプリの表示と同じ。重さの比較には使わない）。' +
      'inProgress=true の日（集計時点で途中）は perUser / highlights / gate に含めない。' +
      `rareClears=上位${RARE_TOP_SHARE * 100}%以内の重い目標を突破、nearMisses=達成率${NEAR_MISS_RATIO * 100}%以上で未達、` +
      `overkills=目標の${OVERKILL_RATIO}倍以上。missingDays=記録が無く集計できなかった日。`,
  };
}
