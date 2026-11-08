// =====================================================================
// デイリーミッション 選出・目標回数ロジック（純粋関数）
// ⚠️ 既存 app.js の同名関数のミラー。両アプリが同じ Firestore の
//    settings_free/daily_mission を共有し、目標回数はシードから
//    各自で再計算する。日付キー・シード文字列・分布定数を変更しないこと。
//    Firestore アクセスは daily-mission-engine.ts 側にある。
// =====================================================================
import type { FreeExerciseMap } from './types';
// 型だけの参照。実行時の import は raid-mode → daily-mission の一方向だけにする
// （raid-mode がこちらの純粋関数を使うため、逆向きに値を持ち込むと循環する）。
import type { RaidDayConfig, RaidProgress } from './raid-mode';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 直近何日分の種目を再選出から避けるか。 */
export const DAILY_RECENT_AVOID = 5;

// 目標回数の分布パラメータ（対数正規。ただし log 空間で上下の σ を変えられる）。
// σ上 = σ下 なら純粋な対数正規そのもので、右に裾を引く形はそのまま。
// σ上を少し小さくしてあるのは、飛び抜けて多い回数を引いたときの絶望を減らすため。
// σ は倍率に対する広がりなのでピーク回数によらず一定（対数正規のスケール不変性）。
export const DAILY_SIGMA_LOW = 0.34;
export const DAILY_SIGMA_HIGH = 0.26;
/** 抽選結果を丸め込む範囲（ピーク比）。 */
export const DAILY_MIN_RATIO = 0.45;
export const DAILY_MAX_RATIO = 2.0;
/** 何があっても下回らない回数。 */
export const DAILY_REPS_FLOOR = 5;
/** 過去に投稿が無い種目のピーク回数。 */
export const DAILY_REPS_DEFAULT_PEAK = 30;
/**
 * 投稿がある種目のピーク＝過去最高回数のこの割合。
 * クリア判定はその日の合計なので、1回の最高記録をそのまま目安にできる。
 */
export const DAILY_PEAK_BEST_RATIO = 1.0;

/** ピーク回数の決まり方。best = 過去最高回数 / default = 投稿が無いので既定値 */
export type DailyPeakSource = 'best' | 'default';

export interface DailyMission {
  dateKey: string;
  exerciseKey: string;
  /** その日の分布のピーク回数（全ユーザー共通） */
  peak: number;
  /** ピークの根拠になった過去最高回数（投稿が無ければ 0） */
  bestValue: number;
  peakSource: DailyPeakSource;
  /** レイド開催日ならその設定。通常のデイリーミッションなら null */
  raid?: RaidDayConfig | null;
}

export interface DailyMissionState {
  dateKey: string;
  exerciseKey: string;
  target: number;
  cleared: boolean;
  /** その日に投稿した回数の合計（1回で達成しなくても積み上げられる） */
  totalValue: number;
  /** 自分の目標を引く確率（0〜1）。領域がある日は今日の領域の中での確率 */
  probability: number;
  /** 今日引いた領域（0〜6）。領域導入前・レイド日などは null */
  zone?: number | null;
  /** 今週の領域の消化（グラフのグレーアウト用）。領域導入前の週・レイド日は null */
  zoneWeek?: DailyZoneWeek | null;
  peak: number;
  bestValue: number;
  peakSource: DailyPeakSource;
  /** その日にログインしたユーザーの目標と達成状況（分布グラフ用） */
  participants: DailyParticipant[];
  /**
   * レイド開催日ならチーム合計の進捗。通常日は null。
   * これが入っている日は個人目標の抽選を行わないので
   * target / probability / peak / participants は空になる。
   */
  raid?: RaidProgress | null;
  /** レイド開始前のメンテナンス日なら true（ミッション自体を出さない）。 */
  maintenance?: boolean;
}

export interface DailyParticipant {
  userId: string;
  userName: string;
  target: number;
  /** 今日引いた領域（0〜6）。領域導入前の日は null */
  zone: number | null;
  /** その目標回数を引く確率（0〜1）。領域がある日はその人の今日の領域の中での確率 */
  probability: number;
  /** その日の合計回数 */
  totalValue: number;
  cleared: boolean;
  isMe: boolean;
}

// ---------------------------------------------------------------------
// 日付キー（JST 0:00 区切り）
// ---------------------------------------------------------------------

/** JST の暦日を YYYY-MM-DD で返す。app.js: getDailyDateKeyJST */
export function getDailyDateKeyJST(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 日付キーに対応する UTC の 1 日境界。app.js: getDailyBoundariesJST */
export function getDailyBoundariesJST(dateKey: string): {
  start: Date;
  end: Date;
} {
  const [y, m, d] = dateKey.split('-').map(Number);
  const startJstMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const start = new Date(startJstMs - JST_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// ---------------------------------------------------------------------
// シード付き乱数（同じ入力なら常に同じ結果）
// ---------------------------------------------------------------------

/** FNV-1a 32bit ハッシュ。app.js: hashStringToSeed */
export function hashStringToSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG。app.js: createSeededRandom */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller 法で標準正規乱数。app.js: seededNormal */
export function seededNormal(rand: () => number): number {
  // u1 = 0 だと log が -Infinity になるため下限を入れる
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ---------------------------------------------------------------------
// 目標回数（ユーザーごとにバラバラ）
// ---------------------------------------------------------------------

/**
 * その種目の過去最高回数からピーク回数を決める。
 * 投稿が一度も無い種目は既定値（30）。app.js: resolveDailyPeak
 */
export function resolveDailyPeak(bestValue: number): number {
  const best = Number(bestValue) || 0;
  if (best <= 0) return DAILY_REPS_DEFAULT_PEAK;
  return Math.max(DAILY_REPS_FLOOR, Math.round(best * DAILY_PEAK_BEST_RATIO));
}

/** ミッションドキュメントに保存された過去最高回数まわりのフィールド。 */
export interface CachedBestValue {
  bestValue?: unknown;
  /** bestValue がどの種目の記録か */
  bestValueKey?: unknown;
  /** bestValue をどの日の締め（当日0:00 JST）で数えたか */
  bestValueDateKey?: unknown;
}

/**
 * 保存済みの過去最高回数を、今日のその種目のものとして信用できるときだけ返す。
 *
 * 種目とセットで照合するのは、ドキュメントを merge で書いているため。
 * bestValue を書かない旧バージョン（〜5776118）が日付をまたぐと
 * dateKey / exerciseKey だけが新しくなり、前日の別種目の bestValue が
 * 残ったまま「今日のピーク」として読まれてしまう。
 * 日付も見るのは、同じ種目が後日また選ばれたときに古い締めの値を使わないため。
 * app.js: readCachedBestValue
 */
export function readCachedBestValue(
  saved: CachedBestValue | null | undefined,
  dateKey: string,
  exerciseKey: string,
): number | null {
  const s = saved || {};
  if (typeof s.bestValue !== 'number' || !isFinite(s.bestValue)) return null;
  if (s.bestValue < 0) return null;
  if (s.bestValueKey !== exerciseKey) return null;
  if (s.bestValueDateKey !== dateKey) return null;
  return s.bestValue;
}

/**
 * log 空間での分布の中心。最頻値がちょうど peak になるよう σ下² だけ右にずらす
 * （対数正規の最頻値 = exp(μ - σ²)）。app.js: dailyLogCenter
 */
export function dailyLogCenter(peak: number): number {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  return Math.log(p) + DAILY_SIGMA_LOW * DAILY_SIGMA_LOW;
}

/** 下側に振れる確率（＝密度が繋がるための面積比）。app.js: DAILY_LOW_WEIGHT */
export const DAILY_LOW_WEIGHT =
  DAILY_SIGMA_LOW / (DAILY_SIGMA_LOW + DAILY_SIGMA_HIGH);

/** 目標回数が取りうる範囲。app.js: dailyRepsBounds */
export function dailyRepsBounds(peak: number): { min: number; max: number } {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const min = Math.max(DAILY_REPS_FLOOR, Math.round(p * DAILY_MIN_RATIO));
  const max = Math.max(min + 1, Math.round(p * DAILY_MAX_RATIO));
  return { min, max };
}

/**
 * ユーザー×日付×種目で決まる目標回数。ピークを最頻値に右へ裾を引く対数正規で、
 * 上側の σ だけ小さくして大きい数字を出にくくしてある。
 * zone（今日引いた領域）を渡すと、その領域の中だけから引く。
 * シードから毎回同じ値を再計算できるため保存不要（リロードしても変わらない）。
 * app.js: generateDailyMissionTarget
 */
export function generateDailyMissionTarget(
  userId: string,
  dateKey: string,
  exerciseKey: string,
  peak: number = DAILY_REPS_DEFAULT_PEAK,
  zone: number | null = null,
): number {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const rand = createSeededRandom(
    hashStringToSeed(`daily-reps|${userId}|${dateKey}|${exerciseKey}`),
  );
  const { min, max } = dailyRepsBounds(p);

  // 領域の中では分布の形どおりに出るよう、領域の累積確率の幅を一様に引いて逆算する
  if (zone != null) {
    const edges = dailyZoneEdges(p);
    const ca = dailyTargetCdf(edges[zone], p);
    const cb = dailyTargetCdf(edges[zone + 1], p);
    const u = ca + rand() * (cb - ca);
    return Math.min(max, Math.max(min, Math.round(dailyTargetQuantile(u, p))));
  }

  // 領域を入れる前の日（週報の再計算が当時の表示とズレないよう）は全域から
  const center = dailyLogCenter(p);
  // どちら側に振れるかは面積比（σ下:σ上）で決める＝境目で密度が繋がる
  const side = rand();
  const z = Math.abs(seededNormal(rand));
  const y =
    side < DAILY_LOW_WEIGHT
      ? center - DAILY_SIGMA_LOW * z
      : center + DAILY_SIGMA_HIGH * z;
  return Math.min(max, Math.max(min, Math.round(Math.exp(y))));
}

// ---------------------------------------------------------------------
// 7つの領域（月〜日で1つずつ消化）
//
// 抽選範囲を、左端〜ピークを等幅で3つ、ピーク〜右端を等幅で4つの計7領域に分ける。
// 週（月曜始まり）の初めに7領域すべてが「残り」に入り、毎日その中から
// 1つを、領域の確率の面積（積分値）に比例した重みで引く。面積の小さい両端は
// 引かれにくい。領域の中での回数は従来どおりユーザー×日×種目のシードで決まる。
//
// 1日の終わりに残りから1つ消える:
//   - クリアした日 → 引いた領域が消える
//   - クリアしなかった日（開かなかった日も） → 引いた領域は残り、代わりに
//     残りの中で回数が一番少ない領域が消える（引いた領域自身が一番少なければそれ）
// サボってきつい領域を飛ばしても、その領域は次の日以降も同じ重みで残る。
// 7日で7つ消えるので、日曜の夜にちょうど空になる。
// レイド開催日は抽選も消化もしない（残りはそのまま）。
// ---------------------------------------------------------------------

/** 左端〜ピークの領域数 */
export const DAILY_ZONE_LOW_COUNT = 3;
/** ピーク〜右端の領域数 */
export const DAILY_ZONE_HIGH_COUNT = 4;
/** 領域の数（＝1週間の日数）。 */
export const DAILY_ZONE_COUNT = DAILY_ZONE_LOW_COUNT + DAILY_ZONE_HIGH_COUNT;
/**
 * 領域を使い始める日（月曜）。これより前の日は従来の全域抽選のまま
 * （週報が過去の目標をシードから再計算するので、当時の表示とズレないように）。
 */
export const DAILY_ZONE_START_DATE_KEY = '2026-11-09';
/** 月〜日の曜日名。 */
export const DAILY_ZONE_WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

/** 日付キーの曜日（0=日〜6=土）。JST の暦日そのものなのでタイムゾーンに依らない。 */
export function dateKeyDayOfWeek(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** その日が属する週の月曜の日付キー（日曜は前の月曜の週に入る）。 */
export function dailyZoneWeekStartKey(dateKey: string): string {
  const dow = dateKeyDayOfWeek(dateKey);
  return shiftDateKey(dateKey, -((dow + 6) % 7));
}

/**
 * 累積確率 u（0〜1）に対応する回数（丸め前の連続値）。dailyTargetCdf の逆関数を
 * log 空間の二分法で求める（回数は固定で 60 回反復＝どの環境でも同じ結果）。
 * app.js: dailyTargetQuantile
 */
export function dailyTargetQuantile(u: number, peak: number): number {
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

/**
 * 領域の境目（丸め前の回数、左端から右端まで DAILY_ZONE_COUNT+1 個）。
 * 左端〜ピークを3等分、ピーク〜右端を4等分。app.js: dailyZoneEdges
 */
export function dailyZoneEdges(peak: number): number[] {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const { min, max } = dailyRepsBounds(p);
  // 下限の切り上げ（5回）でピークが左端より左に来る小さい種目もあるので挟み込む
  const mid = Math.min(max, Math.max(min, p));
  const edges: number[] = [];
  for (let k = 0; k <= DAILY_ZONE_LOW_COUNT; k++) {
    edges.push(min + ((mid - min) * k) / DAILY_ZONE_LOW_COUNT);
  }
  for (let k = 1; k <= DAILY_ZONE_HIGH_COUNT; k++) {
    edges.push(mid + ((max - mid) * k) / DAILY_ZONE_HIGH_COUNT);
  }
  return edges;
}

/** 領域の確率の面積（積分値）。app.js: dailyZoneMass */
export function dailyZoneMass(zone: number, peak: number): number {
  const edges = dailyZoneEdges(peak);
  return Math.max(
    0,
    dailyTargetCdf(edges[zone + 1], peak) - dailyTargetCdf(edges[zone], peak),
  );
}

/**
 * 領域から出うる回数の範囲（整数、両端を含む）。境目の回数は隣の領域からも出うる。
 * app.js: dailyZoneRepsRange
 */
export function dailyZoneRepsRange(
  zone: number,
  peak: number,
): { min: number; max: number } {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const bounds = dailyRepsBounds(p);
  const edges = dailyZoneEdges(p);
  const clamp = (v: number) => Math.min(bounds.max, Math.max(bounds.min, v));
  const lo = clamp(Math.round(edges[zone]));
  const hi = clamp(Math.round(edges[zone + 1]));
  return { min: lo, max: Math.max(lo, hi) };
}

/**
 * 残りの領域それぞれを引く確率（面積に比例、合計 1）。pool と同じ並び。
 * 面積がすべて 0 の（ありえないほど端に寄った）ときは等確率。app.js: dailyZoneDrawWeights
 */
export function dailyZoneDrawWeights(pool: number[], peak: number): number[] {
  const masses = pool.map((z) => dailyZoneMass(z, peak));
  const total = masses.reduce((s, m) => s + m, 0);
  if (!(total > 0)) return pool.map(() => 1 / pool.length);
  return masses.map((m) => m / total);
}

/**
 * 残りの領域から今日の領域を引く（重みは面積に比例）。
 * ユーザー×日付のシードで決まるので、何度開いても同じ領域になる。
 * app.js: pickDailyZone
 */
export function pickDailyZone(
  userId: string,
  dateKey: string,
  pool: number[],
  peak: number,
): number | null {
  if (pool.length === 0) return null;
  const r = createSeededRandom(hashStringToSeed(`daily-zone|${userId}|${dateKey}`))();
  const weights = dailyZoneDrawWeights(pool, peak);
  let acc = 0;
  for (let i = 0; i < pool.length; i++) {
    acc += weights[i];
    if (r < acc) return pool[i];
  }
  // 浮動小数の端数で届かなかったときは、重みのある最後の領域
  for (let i = pool.length - 1; i >= 0; i--) if (weights[i] > 0) return pool[i];
  return pool[pool.length - 1];
}

/**
 * その日の種類。normal = 通常のデイリー / missed = 記録が無い（誰も開かなかった）日
 * ＝未クリア扱い / paused = レイドなど個人目標の無い日（抽選も消化もしない）
 */
export type DailyZoneDayKind = 'normal' | 'missed' | 'paused';

export interface DailyZoneDayInput {
  dateKey: string;
  kind: DailyZoneDayKind;
  /** normal の日の種目とピーク */
  exerciseKey?: string | null;
  peak?: number | null;
}

/** 1日の終わりに領域が消えた理由。clear = 引いてクリア / skip = 未クリアで一番軽い領域が消えた */
export type DailyZoneRemovedBy = 'clear' | 'skip';

export interface DailyZoneDayResult {
  dateKey: string;
  weekday: string;
  kind: DailyZoneDayKind;
  /** その日の抽選前に残っていた領域（軽い順） */
  pool: number[];
  /** その日に引いた領域（missed / paused は null） */
  zone: number | null;
  target: number | null;
  total: number;
  cleared: boolean;
  /** その日の終わりに消えた領域（paused は null） */
  removed: number | null;
  removedBy: DailyZoneRemovedBy | null;
}

/**
 * 1日ぶんの消化。クリアなら引いた領域、そうでなければ残りの中で一番軽い領域が消える。
 * app.js: settleDailyZoneDay
 */
export function settleDailyZoneDay(
  pool: number[],
  zone: number | null,
  cleared: boolean,
): { pool: number[]; removed: number | null; removedBy: DailyZoneRemovedBy | null } {
  if (pool.length === 0) return { pool, removed: null, removedBy: null };
  const clearedZone = cleared && zone != null && pool.includes(zone);
  const removed = clearedZone ? (zone as number) : Math.min(...pool);
  return {
    pool: pool.filter((z) => z !== removed),
    removed,
    removedBy: clearedZone ? 'clear' : 'skip',
  };
}

/**
 * 週の初めから順に、その人の領域の消化をたどる（今日より前の日だけを渡す）。
 * 各日の目標・クリアはその日の種目・ピーク・合計から再計算するので、保存は要らない。
 * app.js: replayDailyZoneWeek
 */
export function replayDailyZoneWeek(
  userId: string,
  days: DailyZoneDayInput[],
  /** 日付キー → userId → その日のその日の種目の合計回数 */
  totalsByDay: Record<string, Record<string, number>>,
): { days: DailyZoneDayResult[]; pool: number[] } {
  let pool = Array.from({ length: DAILY_ZONE_COUNT }, (_, i) => i);
  const results: DailyZoneDayResult[] = [];
  [...days]
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0))
    .forEach((day) => {
      const weekday = DAILY_ZONE_WEEKDAYS[(dateKeyDayOfWeek(day.dateKey) + 6) % 7];
      const total = (totalsByDay[day.dateKey] || {})[userId] || 0;
      const before = pool;
      if (day.kind === 'paused') {
        results.push({
          dateKey: day.dateKey,
          weekday,
          kind: day.kind,
          pool: before,
          zone: null,
          target: null,
          total,
          cleared: false,
          removed: null,
          removedBy: null,
        });
        return;
      }
      let zone: number | null = null;
      let target: number | null = null;
      if (day.kind === 'normal' && day.exerciseKey) {
        const peak = day.peak && day.peak > 0 ? day.peak : DAILY_REPS_DEFAULT_PEAK;
        zone = pickDailyZone(userId, day.dateKey, pool, peak);
        if (zone != null) {
          target = generateDailyMissionTarget(
            userId,
            day.dateKey,
            day.exerciseKey,
            peak,
            zone,
          );
        }
      }
      const cleared = target != null && total >= target;
      const settled = settleDailyZoneDay(pool, zone, cleared);
      pool = settled.pool;
      results.push({
        dateKey: day.dateKey,
        weekday,
        kind: day.kind,
        pool: before,
        zone,
        target,
        total,
        cleared,
        removed: settled.removed,
        removedBy: settled.removedBy,
      });
    });
  return { days: results, pool };
}

export type DailyZoneDayStatus = 'past' | 'today' | 'future';

export interface DailyZoneWeekDay {
  dateKey: string;
  /** 月〜日 */
  weekday: string;
  status: DailyZoneDayStatus;
  /** 引いた領域（先の日・記録の無い日・レイド日は null） */
  zone: number | null;
  /** 済んだ日のクリア（今日・先の日は null） */
  cleared: boolean | null;
  /** 済んだ日の終わりに消えた領域 */
  removed: number | null;
  removedBy: DailyZoneRemovedBy | null;
}

export interface DailyZoneWeek {
  /** 月〜日の7日 */
  days: DailyZoneWeekDay[];
  /** 今日の抽選前に残っていた領域（軽い順） */
  pool: number[];
  /** 今日の抽選での各領域の確率（pool と同じ並び） */
  weights: number[];
  /** 今日の領域 */
  zone: number;
}

/**
 * 今週のここまでの消化をたどり、今日の領域を引く。
 * 領域を入れる前の週・残りが空（レイドで週がずれた等）のときは null（全域から抽選）。
 * app.js: buildDailyZoneWeek
 */
export function buildDailyZoneWeek(
  userId: string,
  todayKey: string,
  /** 今週の今日より前の日（月曜から昨日まで。足りない日は missed 扱い） */
  pastDays: DailyZoneDayInput[],
  totalsByDay: Record<string, Record<string, number>>,
  todayPeak: number,
): DailyZoneWeek | null {
  const weekStart = dailyZoneWeekStartKey(todayKey);
  if (weekStart < DAILY_ZONE_START_DATE_KEY) return null;
  const known: Record<string, DailyZoneDayInput> = {};
  pastDays.forEach((d) => (known[d.dateKey] = d));
  const inputs: DailyZoneDayInput[] = [];
  for (let i = 0; i < DAILY_ZONE_COUNT; i++) {
    const key = shiftDateKey(weekStart, i);
    if (key >= todayKey) break;
    inputs.push(known[key] || { dateKey: key, kind: 'missed' });
  }
  const replay = replayDailyZoneWeek(userId, inputs, totalsByDay);
  const zone = pickDailyZone(userId, todayKey, replay.pool, todayPeak);
  if (zone == null) return null;
  const days: DailyZoneWeekDay[] = DAILY_ZONE_WEEKDAYS.map((weekday, i) => {
    const key = shiftDateKey(weekStart, i);
    const past = replay.days.find((d) => d.dateKey === key);
    if (past) {
      return {
        dateKey: key,
        weekday,
        status: 'past',
        zone: past.zone,
        cleared: past.kind === 'paused' ? null : past.cleared,
        removed: past.removed,
        removedBy: past.removedBy,
      };
    }
    return {
      dateKey: key,
      weekday,
      status: key === todayKey ? 'today' : 'future',
      zone: key === todayKey ? zone : null,
      cleared: null,
      removed: null,
      removedBy: null,
    };
  });
  return {
    days,
    pool: replay.pool,
    weights: dailyZoneDrawWeights(replay.pool, todayPeak),
    zone,
  };
}

/**
 * history.<日付キー> から、その日の消化に要る材料を作る。
 * 記録の無い日は missed（誰も開かなかった＝未クリア）、レイド日は paused。
 * ピークが記録されていない日は peak: null（呼び出し側で過去最高から求め直す）。
 * app.js: dailyZoneDayFromHistory
 */
export function dailyZoneDayFromHistory(
  dateKey: string,
  entry: unknown,
): DailyZoneDayInput {
  if (!entry || typeof entry !== 'object') return { dateKey, kind: 'missed' };
  const e = entry as Record<string, unknown>;
  if (typeof e.raidDay === 'number') return { dateKey, kind: 'paused' };
  if (typeof e.exerciseKey !== 'string' || !e.exerciseKey) {
    return { dateKey, kind: 'missed' };
  }
  const peak = typeof e.peak === 'number' && e.peak > 0 ? e.peak : null;
  return { dateKey, kind: 'normal', exerciseKey: e.exerciseKey, peak };
}

/** 今週の今日より前の日付キー（月曜から昨日まで。領域導入前の週は空）。 */
export function dailyZonePastDateKeys(todayKey: string): string[] {
  const weekStart = dailyZoneWeekStartKey(todayKey);
  if (weekStart < DAILY_ZONE_START_DATE_KEY) return [];
  const keys: string[] = [];
  for (let i = 0; i < DAILY_ZONE_COUNT; i++) {
    const key = shiftDateKey(weekStart, i);
    if (key >= todayKey) break;
    keys.push(key);
  }
  return keys;
}

/** 抽選確率を短い文字列に（領域ラベル用）。app.js: formatDailyZoneShare */
export function formatDailyZoneShare(share: number): string {
  const pct = (Number(share) || 0) * 100;
  if (pct <= 0) return '0%';
  if (pct < 1) return '<1%';
  return `${Math.round(pct)}%`;
}

// ---------------------------------------------------------------------
// 当日の集計
// ---------------------------------------------------------------------

/**
 * 当日の投稿から userId→合計回数 を作る。
 * デイリーミッションは「その日に取り組んだ回数の合計」で達成を判定するので、
 * 週間チャレンジ（ベスト記録）とは違い最大値ではなく足し上げる。
 * app.js: sumDailyTotals
 */
export function sumDailyTotals(
  posts: Array<{ userId: string; exerciseType: string; value: number }>,
  exerciseKey: string,
): Record<string, number> {
  const totals: Record<string, number> = {};
  (posts || []).forEach((post) => {
    if (!post || post.exerciseType !== exerciseKey) return;
    const v = Number(post.value) || 0;
    if (v <= 0) return;
    totals[post.userId] = (totals[post.userId] || 0) + v;
  });
  return totals;
}

// ---------------------------------------------------------------------
// 種目の選出（全ユーザー共通）
// ---------------------------------------------------------------------

/**
 * バーバリアン・デイリーミッション除外以外のフリー種目キー（安定ソート済み）。
 * app.js: getDailyMissionCandidates
 */
export function getDailyMissionCandidates(
  freeExercises: FreeExerciseMap,
): string[] {
  return Object.keys(freeExercises || {})
    .filter(
      (key) =>
        freeExercises[key] &&
        !freeExercises[key].barbarian &&
        !freeExercises[key].excludeFromDaily,
    )
    .sort();
}

/**
 * その日の種目を決定。日付キーのみをシードにするので、複数クライアントが
 * 同時に生成しても（候補が同じなら）同じ種目になる。
 * app.js: pickDailyMissionExercise
 */
export function pickDailyMissionExercise(
  dateKey: string,
  freeExercises: FreeExerciseMap,
  recentKeys: string[] = [],
): string | null {
  const candidates = getDailyMissionCandidates(freeExercises);
  if (candidates.length === 0) return null;

  const avoid = new Set(recentKeys);
  let pool = candidates.filter((key) => !avoid.has(key));
  if (pool.length === 0) pool = candidates;

  const rand = createSeededRandom(hashStringToSeed(`daily-mission|${dateKey}`));
  const idx = Math.min(pool.length - 1, Math.floor(rand() * pool.length));
  return pool[idx];
}

/** 直近履歴の更新（非破壊・先頭が最新）。app.js: pushRecentMissionKeys */
export function pushRecentMissionKeys(
  recentKeys: string[],
  exerciseKey: string,
): string[] {
  return [exerciseKey, ...(recentKeys || []).filter((k) => k !== exerciseKey)].slice(
    0,
    DAILY_RECENT_AVOID,
  );
}

// ---------------------------------------------------------------------
// 日ごとの記録（history）
//
// settings_free/daily_mission は「今日の分」しか持たないので、過去の日に
// どの種目だったかを後から確実に知る手段がなかった（管理画面で引き直す
// こともあるので、シードからの再現も当てにならない）。
// そこで同じドキュメントの history.<日付キー> に、その日の確定内容を残す。
// 週次の集計（analytics）がこれを読んで、デイリーの結果を週報に載せる。
//
// - 書くのは web / app.js / 管理画面（引き直し）の3か所。どれも merge で
//   history.<日付キー> の中の自分が知っているフィールドだけを書く。
//   管理画面だけが書く rerolledFrom / rerolledAt はアプリ側が消さない。
// - 表示には使わない（記録用）。目標回数は従来どおりシードから再計算。
// ---------------------------------------------------------------------

/** history を残す日数。これより古い日は日付が変わる書き込みのついでに消す。 */
export const DAILY_HISTORY_KEEP_DAYS = 180;

/** history.<日付キー> の中身（アプリが書くぶん）。 */
export interface DailyHistoryEntry {
  /** その日に確定した種目（引き直し後の最終） */
  exerciseKey: string;
  /** その日のピーク回数。過去最高を引けていなければ null（集計側で再計算） */
  peak: number | null;
  /** ピークの根拠になった過去最高回数（その日 0:00 より前の全投稿の最大） */
  bestValue: number | null;
  /** レイド開催日なら何日目か・目標回数。通常日は null */
  raidDay: number | null;
  raidGoal: number | null;
}

/**
 * 通常日の history エントリ。bestValue が引けなかった日は peak も null にして、
 * 次の読み込みで引き直したときに上書きされるようにする。
 * app.js: buildDailyHistoryEntry
 */
export function buildDailyHistoryEntry(
  exerciseKey: string,
  bestValue: number | null,
): DailyHistoryEntry {
  const best =
    typeof bestValue === 'number' && isFinite(bestValue) && bestValue >= 0
      ? bestValue
      : null;
  return {
    exerciseKey,
    peak: best == null ? null : resolveDailyPeak(best),
    bestValue: best,
    raidDay: null,
    raidGoal: null,
  };
}

/** レイド開催日の history エントリ。app.js: buildRaidHistoryEntry */
export function buildRaidHistoryEntry(
  exerciseKey: string,
  raidDay: number | null | undefined,
  /** 人数割りの日など、固定の目標回数が無い日は undefined */
  raidGoal: number | null | undefined,
): DailyHistoryEntry {
  return {
    exerciseKey,
    peak: null,
    bestValue: null,
    raidDay: typeof raidDay === 'number' && isFinite(raidDay) ? raidDay : null,
    raidGoal: typeof raidGoal === 'number' && isFinite(raidGoal) ? raidGoal : null,
  };
}

/**
 * 保存済みの history.<日付キー> が entry と同じなら true（書き込み不要）。
 * entry のフィールドだけを見るので、管理画面が書いた rerolledFrom などは
 * 比較に影響しない。毎回の読み込みで書き込みが走らないようにするための判定。
 * app.js: isDailyHistoryUpToDate
 */
export function isDailyHistoryUpToDate(
  history: unknown,
  dateKey: string,
  entry: DailyHistoryEntry,
): boolean {
  if (!history || typeof history !== 'object') return false;
  const saved = (history as Record<string, unknown>)[dateKey];
  if (!saved || typeof saved !== 'object') return false;
  const s = saved as Record<string, unknown>;
  return (Object.keys(entry) as Array<keyof DailyHistoryEntry>).every(
    (k) => (s[k] ?? null) === (entry[k] ?? null),
  );
}

/**
 * 日付キーを n 日ずらす（JST の暦日。日付キー同士の計算なのでタイムゾーンに依らない）。
 */
function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000);
  const yy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(t.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * keepDays より古い（dateKey から数えて keepDays 日以上前の）history のキー。
 * 日付キーの形をしていないキーは触らない。app.js: staleDailyHistoryKeys
 */
export function staleDailyHistoryKeys(
  history: unknown,
  dateKey: string,
  keepDays: number = DAILY_HISTORY_KEEP_DAYS,
): string[] {
  if (!history || typeof history !== 'object') return [];
  const cutoff = shiftDateKey(dateKey, -keepDays);
  return Object.keys(history as object)
    .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k <= cutoff)
    .sort();
}

// ---------------------------------------------------------------------
// 分布グラフ（みんなの目標を1枚に並べる）
// ---------------------------------------------------------------------

/**
 * 目標回数の確率密度（対数正規。中心より上だけ σ が小さい）。
 * 最頻値はちょうどピークで、amp を掛けているので全区間の積分が 1 になる。
 * 目標は保存せずシードから再計算できるので、他ユーザーの回数も
 * Firestore を読まずに全員分ローカルで求められる。app.js: dailyTargetPdf
 */
export function dailyTargetPdf(x: number, peak: number): number {
  if (!(x > 0)) return 0;
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const center = dailyLogCenter(p);
  const d = Math.log(x) - center;
  const s = d < 0 ? DAILY_SIGMA_LOW : DAILY_SIGMA_HIGH;
  const amp = Math.sqrt(2 / Math.PI) / (DAILY_SIGMA_LOW + DAILY_SIGMA_HIGH);
  return (amp / x) * Math.exp(-(d * d) / (2 * s * s));
}

/** 標準正規分布の累積分布。誤差関数は Abramowitz-Stegun 7.1.26 近似。 */
function standardNormalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const a = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * a);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
    t;
  const erf = 1 - poly * Math.exp(-a * a);
  return 0.5 * (1 + sign * erf);
}

/** 目標回数の累積分布（丸め前の連続値ベース）。app.js: dailyTargetCdf */
export function dailyTargetCdf(x: number, peak: number): number {
  if (!(x > 0)) return 0;
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const d = Math.log(x) - dailyLogCenter(p);
  if (d <= 0) return 2 * DAILY_LOW_WEIGHT * standardNormalCdf(d / DAILY_SIGMA_LOW);
  return (
    DAILY_LOW_WEIGHT +
    2 *
      (1 - DAILY_LOW_WEIGHT) *
      (standardNormalCdf(d / DAILY_SIGMA_HIGH) - 0.5)
  );
}

/**
 * その目標回数を引く確率。丸めた結果がその整数になる幅（±0.5）の面積で、
 * 上下限はそこへ丸め込まれる裾ぶんも含める（合計するとちょうど 1 になる）。
 * 領域（zone）を渡すと「その領域の中で引いたときに、その回数になる確率」になる
 * （丸めてその回数になる区間と領域が重なる確率の面積 ÷ 領域の面積）。
 * app.js: dailyTargetProbability
 */
export function dailyTargetProbability(
  target: number,
  peak: number,
  zone: number | null = null,
): number {
  const p = peak > 0 ? peak : DAILY_REPS_DEFAULT_PEAK;
  const { min, max } = dailyRepsBounds(p);
  if (zone != null) {
    const edges = dailyZoneEdges(p);
    const a = dailyTargetCdf(edges[zone], p);
    const b = dailyTargetCdf(edges[zone + 1], p);
    // 幅の無い領域（ありえないほど端に寄った種目）は、その1点に丸まる回数だけ
    if (!(b > a)) {
      const only = Math.min(max, Math.max(min, Math.round(edges[zone])));
      return target === only ? 1 : 0;
    }
    const lo = dailyTargetCdf(target - 0.5, p);
    const hi = dailyTargetCdf(target + 0.5, p);
    const overlap = Math.min(hi, b) - Math.max(lo, a);
    return Math.min(1, Math.max(0, overlap / (b - a)));
  }
  let prob: number;
  if (target <= min) prob = dailyTargetCdf(min + 0.5, p);
  else if (target >= max) prob = 1 - dailyTargetCdf(max - 0.5, p);
  else prob = dailyTargetCdf(target + 0.5, p) - dailyTargetCdf(target - 0.5, p);
  return Math.min(1, Math.max(0, prob));
}

/** 確率をラベル用の短い文字列に。app.js: formatDailyProbability */
export function formatDailyProbability(probability: number): string {
  const pct = (Number(probability) || 0) * 100;
  if (pct <= 0) return '0%';
  if (pct < 0.1) return '<0.1%';
  return `${pct.toFixed(1)}%`;
}

/**
 * 分布カーブの点列。y はピークが 1 になるよう正規化する。
 * app.js: buildDailyDistributionCurve
 */
export function buildDailyDistributionCurve(
  xMin: number,
  xMax: number,
  peak: number,
  steps = 96,
): Array<{ x: number; y: number }> {
  const top = dailyTargetPdf(peak, peak);
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const x = xMin + ((xMax - xMin) * i) / steps;
    points.push({ x, y: top > 0 ? dailyTargetPdf(x, peak) / top : 0 });
  }
  return points;
}

/** 目盛りの刻み候補（小さい順）。app.js: DAILY_AXIS_STEPS */
const DAILY_AXIS_STEPS = [
  5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000,
];
/** 目盛りの本数の上限。これを超えないいちばん細かい刻みを選ぶ。 */
export const DAILY_AXIS_MAX_TICKS = 9;

/**
 * グラフの x 軸の窓（描画範囲と目盛りの刻み）。
 * 0 からではなく抽選されうる範囲だけを映す（0 起点だと分布が右端に寄る）。
 * ピークは種目ごとに大きく変わるので、刻みは本数が増えすぎないものを選ぶ。
 * app.js: dailyAxisWindow
 */
export function dailyAxisWindow(
  lo: number,
  hi: number,
): { min: number; max: number; step: number } {
  for (const step of DAILY_AXIS_STEPS) {
    // 端に点が乗らないよう、両側を1目盛りぶん外へ広げる
    const min = Math.max(0, (Math.ceil(lo / step) - 1) * step);
    const max = (Math.floor(hi / step) + 1) * step;
    if ((max - min) / step <= DAILY_AXIS_MAX_TICKS - 1) return { min, max, step };
  }
  const step = DAILY_AXIS_STEPS[DAILY_AXIS_STEPS.length - 1];
  return { min: 0, max: Math.max(step, Math.ceil(hi / step) * step), step };
}

/**
 * その日のグラフに載せるユーザーか。今日ログインした人だけを対象にし、
 * 自分と「今日すでに投稿した人」は lastActiveDateKey の書き込み有無に
 * 関わらず必ず含める。app.js: isDailyActiveUser
 */
export function isDailyActiveUser(
  user: { lastActiveDateKey?: string } | undefined,
  userId: string,
  dateKey: string,
  totals: Record<string, number>,
  myUserId: string,
): boolean {
  if (userId === myUserId) return true;
  if ((totals[userId] || 0) > 0) return true;
  return (user || {}).lastActiveDateKey === dateKey;
}

export interface BuildDailyParticipantsInput {
  usersMap: Record<
    string,
    { userName?: string; email?: string; lastActiveDateKey?: string }
  >;
  dateKey: string;
  exerciseKey: string;
  /** 当日の投稿から作った userId→合計回数 */
  totals: Record<string, number>;
  myUserId: string;
  peak: number;
  /** userId → 今日の領域。載っていない人は全域から（領域導入前の日） */
  zones?: Record<string, number | null>;
}

/**
 * その日ログインしたユーザーの目標を算出して並べる（目標が小さい順）。
 * app.js: buildDailyParticipants
 */
export function buildDailyParticipants({
  usersMap,
  dateKey,
  exerciseKey,
  totals,
  myUserId,
  peak,
  zones = {},
}: BuildDailyParticipantsInput): DailyParticipant[] {
  return Object.keys(usersMap || {})
    .filter((userId) =>
      isDailyActiveUser(usersMap[userId], userId, dateKey, totals, myUserId),
    )
    .map((userId) => {
      const u = usersMap[userId] || {};
      const zone = zones[userId] ?? null;
      const target = generateDailyMissionTarget(
        userId,
        dateKey,
        exerciseKey,
        peak,
        zone,
      );
      const totalValue = totals[userId] || 0;
      return {
        userId,
        userName: u.userName || u.email || '名無しさん',
        target,
        zone,
        probability: dailyTargetProbability(target, peak, zone),
        totalValue,
        cleared: totalValue >= target,
        isMe: userId === myUserId,
      };
    })
    .sort((a, b) => a.target - b.target || a.userId.localeCompare(b.userId));
}

// ---------------------------------------------------------------------
// みんなの合計（全員ぶんを足し上げた進捗）
// ---------------------------------------------------------------------

export interface DailyContributor {
  userId: string;
  userName: string;
  /** その日の合計回数 */
  value: number;
  target: number;
  cleared: boolean;
  isMe: boolean;
  /** 全体の合計に占める割合（0〜1）。誰も投稿していなければ 0 */
  share: number;
}

export interface DailyTeamProgress {
  /** 全員の当日合計 */
  totalValue: number;
  /** みんなで目指す合計回数 */
  goal: number;
  /** 目標までの残り（達成済みなら 0） */
  remaining: number;
  /** 達成率（0〜100 に丸め込んだ整数） */
  percent: number;
  cleared: boolean;
  /** 貢献の多い順。0回の人も並べる（誰が未着手か分かるように） */
  contributors: DailyContributor[];
  /** 1回以上投稿した人数 */
  activeCount: number;
}

/**
 * その日みんなで目指す合計回数。今は「全員が自分の目標をやり切った状態」＝
 * 個人目標の合計。将来レイドミッション（その日だけ全員で合計◯回を目指す）を
 * 入れるときは、ここが差し替え口になる（表示側はこの数字しか見ていない）。
 * app.js: resolveDailyTeamGoal
 */
export function resolveDailyTeamGoal(participants: DailyParticipant[]): number {
  return (participants || []).reduce(
    (sum, p) => sum + (Number(p.target) || 0),
    0,
  );
}

/**
 * みんなの合計と一人ひとりの貢献を組み立てる。
 * 個人の達成判定と同じく「その日の投稿の合計」を足し上げるだけなので、
 * 分布グラフと同じ participants から追加のFirestore読み取り無しで作れる。
 * app.js: buildDailyTeamProgress
 */
export function buildDailyTeamProgress(
  participants: DailyParticipant[],
): DailyTeamProgress {
  const list = participants || [];
  const totalValue = list.reduce(
    (sum, p) => sum + (Number(p.totalValue) || 0),
    0,
  );
  const goal = resolveDailyTeamGoal(list);
  const contributors: DailyContributor[] = list
    .map((p) => {
      const value = Number(p.totalValue) || 0;
      return {
        userId: p.userId,
        userName: p.userName,
        value,
        target: p.target,
        cleared: p.cleared,
        isMe: p.isMe,
        share: totalValue > 0 ? value / totalValue : 0,
      };
    })
    .sort(
      (a, b) =>
        b.value - a.value ||
        a.target - b.target ||
        a.userId.localeCompare(b.userId),
    );

  return {
    totalValue,
    goal,
    remaining: Math.max(0, goal - totalValue),
    percent: goal > 0 ? Math.min(100, Math.round((totalValue / goal) * 100)) : 0,
    cleared: goal > 0 && totalValue >= goal,
    contributors,
    activeCount: contributors.filter((c) => c.value > 0).length,
  };
}

/**
 * 貢献バーの長さ（0〜1）。いちばん多い人が満杯になるように正規化する。
 * 割合そのものを幅にすると人数が増えたとき全員が細くなって差が見えない。
 * app.js: dailyContributionRatio
 */
export function dailyContributionRatio(
  value: number,
  maxValue: number,
): number {
  if (!(maxValue > 0)) return 0;
  return Math.min(1, Math.max(0, value / maxValue));
}

/** グラフ上のラベルで表示する名前の最大文字数（長い名前は省略する）。 */
export const DAILY_LABEL_NAME_MAX = 6;

/** 長い表示名を省略。app.js: truncateLabelName */
export function truncateLabelName(
  name: string,
  max = DAILY_LABEL_NAME_MAX,
): string {
  const n = name || '';
  return n.length > max ? n.slice(0, max) + '…' : n;
}

/**
 * ラベルが重ならないように段（レーン）へ割り当てる。
 * 位置の昇順に、その段の右端と実際の幅で衝突判定し、空いている最小の段へ置く。
 * どの段にも入らなければ新しい段を開く（= 段さえ増やせば必ず重ならない）。
 * app.js: assignLabelLanes
 * @param positions 各ラベルの中心x（昇順である必要はない）
 * @param widths 各ラベルの幅（positions と同じ並び）
 * @param maxLanes 段の上限。これを超える場合だけ最も余裕のある段に相乗りする
 * @param gap ラベル間に空ける最小の余白
 * @returns 入力順に対応した段番号
 */
export function assignLabelLanes(
  positions: number[],
  widths: number[],
  maxLanes = 8,
  gap = 4,
): number[] {
  const order = positions
    .map((x, i) => ({ x, i }))
    .sort((a, b) => a.x - b.x || a.i - b.i);
  const laneRight: number[] = [];
  const lanes = new Array<number>(positions.length).fill(0);

  order.forEach(({ x, i }) => {
    const half = (widths[i] || 0) / 2;
    const left = x - half;

    let lane = 0;
    for (; lane < laneRight.length; lane++) {
      if (left >= laneRight[lane] + gap) break;
    }
    if (lane === laneRight.length && laneRight.length >= maxLanes) {
      // 段を増やせないので最も右端が手前の段へ（この場合だけ重なりうる）
      lane = 0;
      for (let l = 1; l < laneRight.length; l++) {
        if (laneRight[l] < laneRight[lane]) lane = l;
      }
    }
    laneRight[lane] = x + half;
    lanes[i] = lane;
  });
  return lanes;
}

/** 使用された段数（= 最大段番号+1）。app.js: usedLaneCount */
export function usedLaneCount(lanes: number[]): number {
  return lanes.length === 0 ? 0 : Math.max(...lanes) + 1;
}

// ---------------------------------------------------------------------
// 表示ヘルパー
// ---------------------------------------------------------------------

/** 種目名から単位を推測（種目データに単位情報がないため）。app.js: guessExerciseUnit */
export function guessExerciseUnit(exerciseName: string): string {
  const name = exerciseName || '';
  if (name.includes('秒')) return '秒';
  if (name.includes('セット')) return 'セット';
  if (name.includes('分')) return '分';
  return '回';
}

/**
 * 回数を3桁区切りに（みんなの合計は4桁を超えるので読みづらくなる）。
 * toLocaleString はロケール依存で両アプリの見た目がズレうるので使わない。
 * app.js: formatDailyCount
 */
export function formatDailyCount(value: number): string {
  const n = Math.round(Number(value) || 0);
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 日付キーを「7/26(日)」形式に。app.js: formatDailyDateLabel */
export function formatDailyDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}(${dayNames[dow]})`;
}
