// =====================================================================
// 夏休み特別モード「レイド」設定・進捗ロジック（純粋関数）
// ⚠️ 既存 app.js の同名関数のミラー。両アプリが同じ Firestore の
//    settings_free/daily_mission と posts_free を共有するため、
//    日程表（RAID_SCHEDULE）・種目解決ルール・休止週キーは必ず同じにすること。
//
// レイドは「その日の指定種目を、全員の合計で目標回数まで積み上げる」催し。
// 通常のデイリーミッション（一人ひとり別の目標回数を抽選）とは違い、
// 個人目標の抽選は行わず、チーム合計だけを見る。
// =====================================================================
import {
  getDailyBoundariesJST,
  getDailyDateKeyJST,
  isDailyActiveUser,
} from './daily-mission';
import type { FreeExerciseMap } from './types';

/** バナーやバッジに出す催しの名前。 */
export const RAID_MODE_LABEL = '夏休み特別モード';
/** デイリーの枠に出す特殊モード名。 */
export const RAID_TITLE = 'レイド開催';

/**
 * レイド開始前にメンテナンス表示を出す日（JST 日付キー）。
 * この日はデイリーミッションを止め、翌0:00からのレイド開始だけを告知する。
 */
export const RAID_MAINTENANCE_DATE_KEYS = ['2026-08-08'];

/** レイド初日・最終日（表示用。実際の判定は RAID_SCHEDULE の有無で行う）。 */
export const RAID_START_DATE_KEY = '2026-08-09';
export const RAID_END_DATE_KEY = '2026-08-16';

/**
 * 週間チャレンジを休止する週。値は「週の起点（日曜17:00 JST）」の JST 日付キー。
 * 2026-08-09 の週 = 月〜金が 8/10〜8/14（夏休み週）。
 */
export const WEEKLY_PAUSE_WEEK_KEYS = ['2026-08-09'];
export const WEEKLY_PAUSE_LABEL = '夏休み休止';
export const WEEKLY_PAUSE_NOTE =
  '夏休みのため、今週の週間チャレンジはお休みです。種目の選出も得点集計もありません。';
export const WEEKLY_PAUSE_RESUME_NOTE = '再開は 8/17(月) の週から。';

/** 管理者が目標回数を上書きする Firestore ドキュメント（settings_free/）。 */
export const RAID_CONFIG_DOC = 'raid_config';

/** 目標回数の出どころ。default = コードの日程表 / override = 管理画面での設定 */
export type RaidGoalSource = 'default' | 'override';

/** 日付キー → 目標回数。管理画面で設定された日だけが入る。 */
export type RaidGoalOverrides = Record<string, number>;

/** 日付キー → 種目キー。管理画面で種目を明示指定した日だけが入る。 */
export type RaidExerciseOverrides = Record<string, string>;

/** レイドの設定一式（管理画面での上書き＋開催中に記録した人数）。 */
export interface RaidOverrides {
  goals: RaidGoalOverrides;
  exercises: RaidExerciseOverrides;
  /** 日付キー → その日のログイン人数（アプリが自動で記録する） */
  memberCounts: RaidMemberCounts;
}

/** レイド1日ぶんの設定。 */
export interface RaidDayConfig {
  /** JST 日付キー 'YYYY-MM-DD' */
  dateKey: string;
  /** 何日目か（1始まり） */
  day: number;
  /**
   * 通算ブロック（RAID_BLOCKS）に属する日はその id。
   * ブロックの日は1日で完結せず、ブロック全体の合計で1体のボスを削る。
   */
  blockId?: string;
  /**
   * 種目の探し方。登録種目の「名前」に対する部分一致候補を優先順に並べる。
   * フリー種目のキーは 'free_<timestamp>' で環境ごとに違うため、
   * キー直指定ではなく名前で引き当てる。
   */
  nameHints: string[];
  /**
   * その日みんなで積み上げる合計の固定目標。
   * perPerson を使う日（2日目以降）は持たない。
   */
  goal?: number;
  /**
   * 1人あたりの目標回数。その日のログイン人数を掛けたものが当日の目標になる。
   * 人が集まるほど目標も上がる＝集まった価値がそのまま数字に出るようにするため。
   */
  perPerson?: number;
  /** カードに出す一言。 */
  label: string;
  /** 目標の数字がどこから来たか。applyRaidGoalOverride を通したときだけ入る。 */
  goalSource?: RaidGoalSource;
}

/**
 * その日の設定値（固定目標なら goal、人数割なら perPerson）。
 * 管理画面はこの数字を編集し、上書きも同じ意味で保存する。
 */
export function raidConfiguredValue(config: RaidDayConfig): number {
  return (config.perPerson != null ? config.perPerson : config.goal) || 0;
}

/** その日が「ログイン人数 × 1人あたり」で目標を出す日か。 */
export function isPerPersonRaidDay(config: RaidDayConfig): boolean {
  return config.perPerson != null;
}

/**
 * その日のレイドボスの体力（＝みんなで積み上げる目標）。
 * 人数割の日は「前日にログインした人数 × 1人あたり」。人数が 0 でも
 * 1人ぶんは残す（体力 0 で即討伐、という見え方を避けるため）。
 */
export function resolveRaidGoal(
  config: RaidDayConfig,
  memberCount: number,
): number {
  if (config.perPerson != null) {
    return config.perPerson * Math.max(1, Math.round(memberCount) || 0);
  }
  return config.goal || 0;
}

/** 前日の JST 日付キー。 */
export function getPreviousDateKey(dateKey: string): string {
  const { start } = getDailyBoundariesJST(dateKey);
  // 当日 0:00 JST の 1ms 前 ＝ 前日 23:59:59.999 JST
  return getDailyDateKeyJST(new Date(start.getTime() - 1));
}

/** 人数がどこから来たか。recorded = 当日に記録した実数 / estimated = 概算 */
export type RaidMemberCountSource = 'recorded' | 'estimated';

export interface ResolvedRaidMemberCount {
  count: number;
  /** どの日の人数か（＝前日） */
  dateKey: string;
  source: RaidMemberCountSource;
}

/** sinceDateKey 以降にアプリを開いた形跡があるユーザー数。 */
export function countActiveUsersSince(
  usersMap: Record<string, { lastActiveDateKey?: string }>,
  sinceDateKey: string,
): number {
  return Object.values(usersMap || {}).filter(
    (u) => !!u && !!u.lastActiveDateKey && u.lastActiveDateKey >= sinceDateKey,
  ).length;
}

/**
 * ボスの体力を決める人数（＝前日のログイン人数）を解決する。
 *
 * 当日のログイン人数だと日中ずっと体力が動いて数字が定まらないので、
 * 前日ぶんを使って 0:00 の時点で確定させる。
 *
 * 前日の人数は開催中に記録したものを使う（`users.lastActiveDateKey` は
 * 最後に開いた日しか持たないため、後から「前日ログインしていた人」を
 * 数え直すことはできない）。記録が無い日は「前日以降にアプリを開いた人数」で
 * 概算する——前日に開いた人はたいてい当日以降も開くので近い数になる。
 */
export function resolveRaidMemberCount(
  dateKey: string,
  memberCounts: RaidMemberCounts | null | undefined,
  usersMap: Record<string, { lastActiveDateKey?: string }>,
): ResolvedRaidMemberCount {
  const prevKey = getPreviousDateKey(dateKey);
  const recorded = (memberCounts || {})[prevKey];
  if (typeof recorded === 'number' && recorded > 0) {
    return { count: recorded, dateKey: prevKey, source: 'recorded' };
  }
  return {
    count: Math.max(1, countActiveUsersSince(usersMap, prevKey)),
    dateKey: prevKey,
    source: 'estimated',
  };
}

/** 目標回数として受け付ける範囲。桁を打ち間違えても壊れないように上限を置く。 */
export const RAID_GOAL_MIN = 1;
export const RAID_GOAL_MAX = 1000000;

/**
 * Firestore から読んだ上書き設定を、信用できる形に整える。
 * 日程表に無い日付・数値でない値・範囲外は落とす（管理画面の入力ミスや
 * 古い日程表の残骸で、その日のレイドが壊れないようにするため）。
 */
export function sanitizeRaidGoalOverrides(raw: unknown): RaidGoalOverrides {
  const out: RaidGoalOverrides = {};
  if (!raw || typeof raw !== 'object') return out;
  const scheduled = new Set(RAID_SCHEDULE.map((d) => d.dateKey));
  Object.entries(raw as Record<string, unknown>).forEach(([dateKey, value]) => {
    if (!scheduled.has(dateKey)) return;
    const n = Number(value);
    if (!isFinite(n)) return;
    const goal = Math.round(n);
    if (goal < RAID_GOAL_MIN || goal > RAID_GOAL_MAX) return;
    out[dateKey] = goal;
  });
  return out;
}

/**
 * Firestore から読んだ種目の指定を、信用できる形に整える。
 * 日程表に無い日付・種目キーでない値は落とす。
 * 「その種目が今も登録されているか」は resolveRaidExerciseKey 側で見る
 * （消された種目を指していたら名前ヒントに落とすため）。
 */
export function sanitizeRaidExerciseOverrides(
  raw: unknown,
): RaidExerciseOverrides {
  const out: RaidExerciseOverrides = {};
  if (!raw || typeof raw !== 'object') return out;
  const scheduled = new Set(RAID_SCHEDULE.map((d) => d.dateKey));
  Object.entries(raw as Record<string, unknown>).forEach(([dateKey, value]) => {
    if (!scheduled.has(dateKey)) return;
    if (typeof value !== 'string' || value === '') return;
    out[dateKey] = value;
  });
  return out;
}

/**
 * 管理画面での上書きを日程表に反映した設定を返す（非破壊）。
 * 上書きが無い日はコードの既定値をそのまま使う。
 */
export function applyRaidGoalOverride(
  config: RaidDayConfig,
  overrides: RaidGoalOverrides | null | undefined,
): RaidDayConfig {
  const override = (overrides || {})[config.dateKey];
  if (typeof override !== 'number') {
    return { ...config, goalSource: 'default' };
  }
  // 上書きの数字は「その日の設定値」＝人数割の日なら1人あたり、
  // 固定の日なら合計。どちらを差し替えるかは日程表側の形で決まる
  if (config.perPerson != null) {
    return { ...config, perPerson: override, goalSource: 'override' };
  }
  return { ...config, goal: override, goalSource: 'override' };
}

/**
 * その日のログイン人数（＝目標の掛け算に使った人数）の記録。
 * 過去の日はもう「その日ログインしていた人」を復元できないので、
 * 開催中に見えた最大人数を保存しておき、成績表ではそれを使う。
 */
export type RaidMemberCounts = Record<string, number>;

/** 保存済みの人数を、日程表にある日・妥当な整数だけに絞る。 */
export function sanitizeRaidMemberCounts(raw: unknown): RaidMemberCounts {
  const out: RaidMemberCounts = {};
  if (!raw || typeof raw !== 'object') return out;
  const scheduled = new Set(RAID_SCHEDULE.map((d) => d.dateKey));
  Object.entries(raw as Record<string, unknown>).forEach(([dateKey, value]) => {
    if (!scheduled.has(dateKey)) return;
    const n = Number(value);
    if (!isFinite(n)) return;
    const count = Math.round(n);
    if (count < 1 || count > 1000) return;
    out[dateKey] = count;
  });
  return out;
}

/** 3日通算ブロック「複合種目総合1」の識別子・種目名・名前ヒント。 */
export const RAID_BLOCK_TOTAL_1 = 'total1';
export const RAID_BLOCK_TOTAL_1_TITLE = '複合種目総合1';
/**
 * ブロックの3日はすべてこの種目。表記ゆれ（数字なし・「総合」なし）でも
 * 拾えるように短い候補を後ろに置く。素の「複合種目」まで落ちれば、
 * 名前が短いほうを優先する pickByNameHints がいちばん素直な名前を選ぶ。
 */
export const RAID_BLOCK_TOTAL_1_HINTS = [
  '複合種目総合1',
  '複合種目総合',
  '複合種目',
];

/**
 * レイドの日程表。1日ずつ部位を替えて一巡させる。
 *
 * 初日だけ固定 1000回。2日目以降は `perPerson`（1人あたり）× その日の
 * ログイン人数を目標にする＝人が集まるほど目標も上がる。
 *
 * ⚠️ nameHints に一致する種目が登録されていない日は、レイドを行わず
 *    通常のデイリーミッションにフォールバックする（getRaidDayConfig の
 *    呼び出し側ではなく resolveRaidExerciseKey が null を返すことで判定）。
 */
export const RAID_SCHEDULE: RaidDayConfig[] = [
  {
    dateKey: '2026-08-09',
    day: 1,
    // 「腕立て」だけだと派生種目（腕立てジャンプ等）も拾うので、
    // 素の種目に付きやすい名前を先に見る
    nameHints: ['プッシュアップ', '腕立て伏せ', '腕立て', 'push'],
    // 初日は開催済み。人数割に変えると確定した結果が動いてしまうので固定のまま
    goal: 1000,
    label: '開幕戦。全員で1000回（この日だけ固定目標）。',
  },
  {
    dateKey: '2026-08-10',
    day: 2,
    nameHints: ['スクワット', 'squat'],
    perPerson: 200,
    label: '脚の日。数で押し切ろう。',
  },
  {
    dateKey: '2026-08-11',
    day: 3,
    nameHints: ['懸垂', 'チンニング', 'プルアップ', 'pull'],
    perPerson: 100,
    label: '背中の日。1回の重みがいちばん大きい。',
  },
  {
    dateKey: '2026-08-12',
    day: 4,
    nameHints: ['クラップクランチ', 'クラップ', 'clap crunch', 'clap'],
    perPerson: 200,
    label: '腹の日。すきま時間で積み上げ。',
  },
  {
    dateKey: '2026-08-13',
    day: 5,
    // レイド用に用意された「ディップス(レイド)」を先に見る。素の「ディップス」も
    // 一致するうえ、名前が短いほうが優先されるので、明示しないとそちらに寄る
    nameHints: ['ディップス(レイド)', 'ディップス（レイド）', 'ディップス', 'dip'],
    perPerson: 120,
    label: '胸と二の腕。押す種目でもう一押し。',
  },
  // 8/14〜8/16 は「複合種目総合1」の3日通算ブロック（RAID_BLOCK_TOTAL_1）。
  // 3日とも同じ種目・同じ1人あたりで、体力も進捗も3日ぶんをひとまとめに見る
  {
    dateKey: '2026-08-14',
    day: 6,
    blockId: RAID_BLOCK_TOTAL_1,
    nameHints: RAID_BLOCK_TOTAL_1_HINTS,
    perPerson: 80,
    label: '3日通算の1日目。ここからの積み上げが最終日まで残る。',
  },
  {
    dateKey: '2026-08-15',
    day: 7,
    blockId: RAID_BLOCK_TOTAL_1,
    nameHints: RAID_BLOCK_TOTAL_1_HINTS,
    perPerson: 80,
    label: '3日通算の2日目。折り返し。',
  },
  {
    dateKey: '2026-08-16',
    day: 8,
    blockId: RAID_BLOCK_TOTAL_1,
    nameHints: RAID_BLOCK_TOTAL_1_HINTS,
    perPerson: 80,
    label: '3日通算の最終日。ここまでの合計で討伐判定。',
  },
];

/**
 * 通算ブロック：複数日をひとつの種目でつなぎ、その期間の**合計**で
 * 1体のボスを削る単位。日ごとに区切らないので、前の日に積んだぶんは
 * 最終日まで残る（1日だけ出られなかった人も置いていかれない）。
 *
 * ブロックの日は個別の目標を持たず、体力も進捗率も討伐判定もブロック全体で1つ。
 * ただし積み上げ得点（RAID_POINTS_PER_DAY）はこれまでどおり日ごとに分け合う。
 */
export interface RaidBlockConfig {
  /** RaidDayConfig.blockId と対応する識別子。 */
  id: string;
  /** 画面に出すブロックの名前。 */
  title: string;
  /** 対象日（JST 日付キー、昇順）。RAID_SCHEDULE の日と一致させること。 */
  dateKeys: string[];
  /** カードに出す一言。 */
  label: string;
}

export const RAID_BLOCKS: RaidBlockConfig[] = [
  {
    id: RAID_BLOCK_TOTAL_1,
    title: RAID_BLOCK_TOTAL_1_TITLE,
    dateKeys: ['2026-08-14', '2026-08-15', '2026-08-16'],
    label: '3日通算。1種目を最終日まで積み上げて、1体のボスを削り切る。',
  },
];

/** レイド全体の日数。 */
export const RAID_TOTAL_DAYS = RAID_SCHEDULE.length;

/** id からブロック設定を引く。 */
export function getRaidBlock(
  blockId: string | null | undefined,
): RaidBlockConfig | null {
  if (!blockId) return null;
  return RAID_BLOCKS.find((b) => b.id === blockId) || null;
}

/** その日が属する通算ブロック。単独開催の日は null。 */
export function getRaidBlockForDate(dateKey: string): RaidBlockConfig | null {
  const config = getRaidDayConfig(dateKey);
  return config ? getRaidBlock(config.blockId) : null;
}

/** ブロックに属する日の設定（日付順）。 */
export function getRaidBlockDayConfigs(block: RaidBlockConfig): RaidDayConfig[] {
  return RAID_SCHEDULE.filter((d) => d.blockId === block.id);
}

/** ブロックの中で何日目か（1始まり）。含まれない日は 0。 */
export function raidBlockDayIndex(
  block: RaidBlockConfig,
  dateKey: string,
): number {
  return block.dateKeys.indexOf(dateKey) + 1;
}

/** 上書きを適用したブロック1つぶんの設定。 */
export interface RaidBlockPlan {
  block: RaidBlockConfig;
  /** 上書き適用済みの日ごとの設定（日付順）。 */
  dayConfigs: RaidDayConfig[];
}

/** 管理画面での上書きをブロックの各日に反映する（非破壊）。 */
export function planRaidBlock(
  block: RaidBlockConfig,
  goalOverrides?: RaidGoalOverrides | null,
): RaidBlockPlan {
  return {
    block,
    dayConfigs: getRaidBlockDayConfigs(block).map((c) =>
      applyRaidGoalOverride(c, goalOverrides),
    ),
  };
}

/**
 * ブロックのボスの体力＝各日の目標の合計。
 * 人数は「ブロック初日に確定した1つ」を全日に使う。日ごとに数え直すと
 * 期間の途中で体力が動いて、積み上げた割合の意味が変わってしまうため。
 */
export function resolveRaidBlockGoal(
  plan: RaidBlockPlan,
  memberCount: number,
): number {
  return plan.dayConfigs.reduce(
    (sum, config) => sum + resolveRaidGoal(config, memberCount),
    0,
  );
}

/**
 * 1人あたりの通算目標。全日が人数割のときだけ意味を持つので、
 * 固定目標の日が混ざるブロックでは null（＝合計だけを見せる）。
 */
export function raidBlockPerPerson(plan: RaidBlockPlan): number | null {
  if (plan.dayConfigs.some((c) => c.perPerson == null)) return null;
  return plan.dayConfigs.reduce((sum, c) => sum + (c.perPerson || 0), 0);
}

/** ブロックの目標がコードの既定か、1日でも管理画面で上書きされているか。 */
export function raidBlockGoalSource(plan: RaidBlockPlan): RaidGoalSource {
  return plan.dayConfigs.some((c) => c.goalSource === 'override')
    ? 'override'
    : 'default';
}

// ---------------------------------------------------------------------
// 0時発表 → 7時入力開始
// ---------------------------------------------------------------------

/** 入力を受け付け始める時刻（JST）。それまでは種目だけ見えている。 */
export const RAID_INPUT_OPEN_HOUR_JST = 7;

/**
 * この日以降は「0時発表・7時入力開始」で運用する。
 * 初日（8/9）はすでに走り出しているので、途中で入力を止めない。
 */
export const RAID_INPUT_GATE_FROM_DATE_KEY = '2026-08-10';

/** なぜ発表と入力開始をずらすのか。画面にそのまま出す説明。 */
export const RAID_INPUT_GATE_NOTE =
  '種目は0:00に発表、入力できるのは7:00からです。前の晩のうちに今日なにをやるか分かるようにしつつ、'
  + '深夜のうちに先に積んだ人が有利にならないよう、朝いちで全員が同じスタートラインに立つためです。';

/** その日が「7時から入力」の対象か（初日は対象外）。 */
export function isRaidInputGatedDay(dateKey: string): boolean {
  return dateKey >= RAID_INPUT_GATE_FROM_DATE_KEY;
}

/** その日の入力開始時刻（7:00 JST）を UTC の Date で返す。 */
export function getRaidInputOpenAt(dateKey: string): Date {
  const { start } = getDailyBoundariesJST(dateKey);
  return new Date(start.getTime() + RAID_INPUT_OPEN_HOUR_JST * 60 * 60 * 1000);
}

/**
 * いま入力を受け付けてよいか。
 * ゲート対象外の日（初日）は常に true。
 */
export function isRaidInputOpen(
  dateKey: string,
  now: Date = new Date(),
): boolean {
  if (!isRaidInputGatedDay(dateKey)) return true;
  return now.getTime() >= getRaidInputOpenAt(dateKey).getTime();
}

// ---------------------------------------------------------------------
// 貢献度の点数化
// ---------------------------------------------------------------------

/**
 * 1日ぶんの持ち点。その日の合計に対する貢献度（％）をそのまま点にするので、
 * 参加者の点を全部足すとちょうどこの数になる（誰も投稿しなければ0）。
 */
export const RAID_POINTS_PER_DAY = 100;

/** その日がレイド開始前のメンテナンス日か。 */
export function isRaidMaintenanceDay(dateKey: string): boolean {
  return RAID_MAINTENANCE_DATE_KEYS.includes(dateKey);
}

/** その日のレイド設定。レイド期間外なら null。 */
export function getRaidDayConfig(dateKey: string): RaidDayConfig | null {
  return RAID_SCHEDULE.find((d) => d.dateKey === dateKey) || null;
}

/**
 * この種目はレイド向け、と種目側で宣言するためのタグ。
 * 名前からの推測より確実なので、付いていればこちらを優先する。
 */
export const RAID_TAG = 'レイド';

/** その日にレイドで使える種目か（バーバリアンは短いほど良い＝合計で競えない）。 */
function isRaidEligible(
  freeExercises: FreeExerciseMap,
  key: string,
): boolean {
  const ex = (freeExercises || {})[key];
  return !!ex && !ex.barbarian;
}

/** 「レイド」タグが付いているか。 */
export function hasRaidTag(
  freeExercises: FreeExerciseMap,
  key: string,
): boolean {
  const ex = (freeExercises || {})[key];
  return !!ex && Array.isArray(ex.tags) && ex.tags.includes(RAID_TAG);
}

/** その日の種目がどう決まったか。 */
export type RaidExerciseSource = 'pinned' | 'tag' | 'name';

export interface ResolvedRaidExercise {
  key: string | null;
  /** key が null のときは null */
  source: RaidExerciseSource | null;
}

/**
 * 候補の中から名前ヒントで1件選ぶ。
 * ⚠️ 部分一致の中では**名前が短いものを優先**する。「腕立て」で引くと
 *    「腕立てジャンプ」のような派生種目も一致してしまい、キー順で先に
 *    出たほうが勝つと意図しない種目になる（実際に初日で踏んだ）。
 *    余計な語が付いていない＝名前が短いほうが素の種目、という前提で選ぶ。
 *    名前の長さが並んだらキー昇順にして、どの端末でも同じ種目に決める。
 */
function pickByNameHints(
  config: RaidDayConfig,
  freeExercises: FreeExerciseMap,
  keys: string[],
): string | null {
  const nameOf = (key: string) => freeExercises[key].name || '';
  for (const hint of config.nameHints) {
    const needle = hint.toLowerCase();
    const matches = keys
      .filter((key) => nameOf(key).toLowerCase().includes(needle))
      .sort(
        (a, b) => nameOf(a).length - nameOf(b).length || a.localeCompare(b),
      );
    if (matches.length > 0) return matches[0];
  }
  return null;
}

/**
 * レイドの種目を登録種目から引き当てる。優先順は次のとおり。
 *
 * 1. `pinned` 管理画面でその日の種目が指定されていればそれ（最優先）。
 * 2. `tag`    「レイド」タグが付いた種目に絞って名前ヒントで選ぶ。
 *             名前からの推測より、種目側の宣言のほうが確実なため。
 * 3. `name`   タグ付きに該当が無ければ、全種目から名前ヒントで選ぶ。
 *             タグを1つも付けていない環境でも動かすためのフォールバック。
 *
 * どれにも当たらなければ key は null（その日はレイドを行わない）。
 */
export function resolveRaidExercise(
  config: RaidDayConfig,
  freeExercises: FreeExerciseMap,
  exerciseOverrides?: RaidExerciseOverrides | null,
): ResolvedRaidExercise {
  const pinned = (exerciseOverrides || {})[config.dateKey];
  if (pinned && isRaidEligible(freeExercises, pinned)) {
    return { key: pinned, source: 'pinned' };
  }

  const eligible = Object.keys(freeExercises || {}).filter((key) =>
    isRaidEligible(freeExercises, key),
  );

  const tagged = eligible.filter((key) => hasRaidTag(freeExercises, key));
  const byTag = pickByNameHints(config, freeExercises, tagged);
  if (byTag) return { key: byTag, source: 'tag' };

  const byName = pickByNameHints(config, freeExercises, eligible);
  if (byName) return { key: byName, source: 'name' };

  return { key: null, source: null };
}

/** 種目キーだけが要るとき用の薄いラッパ。 */
export function resolveRaidExerciseKey(
  config: RaidDayConfig,
  freeExercises: FreeExerciseMap,
  exerciseOverrides?: RaidExerciseOverrides | null,
): string | null {
  return resolveRaidExercise(config, freeExercises, exerciseOverrides).key;
}

/** 週の起点（日曜17:00 JST）がレイドによる週間チャレンジ休止週か。 */
export function isWeeklyPausedWeekStart(weekStart: Date | null): boolean {
  if (!weekStart) return false;
  return WEEKLY_PAUSE_WEEK_KEYS.includes(getDailyDateKeyJST(weekStart));
}

// ---------------------------------------------------------------------
// 進捗（全員の合計）
// ---------------------------------------------------------------------

export interface RaidContributor {
  userId: string;
  userName: string;
  /** その日の合計回数 */
  value: number;
  isMe: boolean;
  /** 全体の合計に占める割合（0〜1）。誰も投稿していなければ 0 */
  share: number;
}

/** 通算ブロックの日に出す、ブロックそのものの情報。 */
export interface RaidProgressBlock {
  id: string;
  title: string;
  label: string;
  startDateKey: string;
  endDateKey: string;
  /** ブロックの日数 */
  dayCount: number;
  /** 今日がブロックの何日目か（1始まり） */
  dayIndex: number;
  /** 1人あたりの通算目標（全日が人数割のときだけ） */
  perPersonTotal: number | null;
}

export interface RaidProgress {
  day: number;
  totalDays: number;
  /**
   * 目標。人数割の日は perPerson × memberCount。
   * 通算ブロックの日はブロック全体（＝期間ぶんの合計）の目標。
   */
  goal: number;
  /** goal の数字がコードの既定か管理画面での設定か */
  goalSource: RaidGoalSource;
  /**
   * 1人あたりの体力（人数割の日のみ）。固定目標の日は null。
   * 通算ブロックの日は「1人あたりの通算」（＝期間ぶんの合計）。
   */
  perPerson: number | null;
  /** 体力の掛け算に使った人数（＝前日ログインした人の数） */
  memberCount: number;
  /** memberCount がどの日の人数か（＝前日）。固定目標の日は null */
  memberCountDateKey: string | null;
  /** 記録された実数か概算か */
  memberCountSource: RaidMemberCountSource | null;
  label: string;
  /** 通算ブロックの日だけ入る。単独開催の日は null */
  block: RaidProgressBlock | null;
  /** 全員の合計。通算ブロックの日は期間ぶんの通算 */
  totalValue: number;
  /** 全員の当日ぶんの合計（ブロックでない日は totalValue と同じ） */
  todayValue: number;
  /** 目標までの残り（達成済みなら 0） */
  remaining: number;
  /** 達成率（0〜100 に丸め込んだ整数） */
  percent: number;
  cleared: boolean;
  /** 自分の合計。通算ブロックの日は期間ぶんの通算 */
  myValue: number;
  /** 自分の当日ぶんの合計（ブロックでない日は myValue と同じ） */
  myTodayValue: number;
  /** 貢献の多い順。0回の人も並べる（誰が未着手か分かるように） */
  contributors: RaidContributor[];
  /** 1回以上投稿した人数 */
  activeCount: number;
}

export interface BuildRaidProgressInput {
  usersMap: Record<string, { userName?: string; email?: string; lastActiveDateKey?: string }>;
  dateKey: string;
  /**
   * 投稿から作った userId→合計回数。
   * 通算ブロックの日は「ブロック開始日から今日まで」の通算を渡す。
   */
  totals: Record<string, number>;
  myUserId: string;
  config: RaidDayConfig;
  /** 記録済みの日別ログイン人数。前日ぶんをボスの体力に使う */
  memberCounts?: RaidMemberCounts | null;
  /** 通算ブロックの日だけ渡す。体力・達成判定がブロック全体になる */
  blockPlan?: RaidBlockPlan | null;
  /** 当日ぶんの userId→合計回数。省略時は totals と同じ扱い */
  todayTotals?: Record<string, number> | null;
}

/**
 * レイドの進捗を組み立てる。
 * 並ぶのは通常のデイリーミッションと同じ「今日ログインした人」＋投稿済みの人。
 * 個人目標の抽選は無いので、達成判定はチーム合計だけを見る。
 */
export function buildRaidProgress({
  usersMap,
  dateKey,
  totals,
  myUserId,
  config,
  memberCounts,
  blockPlan,
  todayTotals,
}: BuildRaidProgressInput): RaidProgress {
  const today = todayTotals || totals;
  const rows = Object.keys(usersMap || {})
    .filter((userId) =>
      isDailyActiveUser(usersMap[userId], userId, dateKey, totals, myUserId),
    )
    .map((userId) => {
      const u = usersMap[userId] || {};
      return {
        userId,
        userName: u.userName || u.email || '名無しさん',
        value: Number(totals[userId]) || 0,
        isMe: userId === myUserId,
      };
    });

  const totalValue = rows.reduce((sum, r) => sum + r.value, 0);
  const contributors: RaidContributor[] = rows
    .map((r) => ({ ...r, share: totalValue > 0 ? r.value / totalValue : 0 }))
    .sort(
      (a, b) =>
        b.value - a.value ||
        a.userName.localeCompare(b.userName) ||
        a.userId.localeCompare(b.userId),
    );

  // ボスの体力は「前日ログインした人数 × 1人あたり」。
  // 当日の人数だと日中ずっと動いてしまうので、前日ぶんで 0:00 に確定させる。
  // 通算ブロックの日は「ブロック初日の前日」で数え、期間中ずっと同じ体力にする
  const goalDateKey = blockPlan ? blockPlan.block.dateKeys[0] : dateKey;
  const members = resolveRaidMemberCount(goalDateKey, memberCounts, usersMap);
  const perPerson = blockPlan
    ? raidBlockPerPerson(blockPlan)
    : config.perPerson != null
      ? config.perPerson
      : null;
  const goal = blockPlan
    ? resolveRaidBlockGoal(blockPlan, members.count)
    : resolveRaidGoal(config, members.count);
  const block: RaidProgressBlock | null = blockPlan
    ? {
        id: blockPlan.block.id,
        title: blockPlan.block.title,
        label: blockPlan.block.label,
        startDateKey: blockPlan.block.dateKeys[0],
        endDateKey: blockPlan.block.dateKeys[blockPlan.block.dateKeys.length - 1],
        dayCount: blockPlan.block.dateKeys.length,
        dayIndex: raidBlockDayIndex(blockPlan.block, dateKey),
        perPersonTotal: perPerson,
      }
    : null;
  return {
    day: config.day,
    totalDays: RAID_TOTAL_DAYS,
    goal,
    goalSource: blockPlan
      ? raidBlockGoalSource(blockPlan)
      : config.goalSource || 'default',
    perPerson,
    memberCount: members.count,
    memberCountDateKey: perPerson != null ? members.dateKey : null,
    memberCountSource: perPerson != null ? members.source : null,
    label: config.label,
    block,
    totalValue,
    todayValue: rows.reduce(
      (sum, r) => sum + (Number(today[r.userId]) || 0),
      0,
    ),
    remaining: Math.max(0, goal - totalValue),
    percent: goal > 0 ? Math.min(100, Math.round((totalValue / goal) * 100)) : 0,
    cleared: goal > 0 && totalValue >= goal,
    myValue: Number(totals[myUserId]) || 0,
    myTodayValue: Number(today[myUserId]) || 0,
    contributors,
    activeCount: contributors.filter((c) => c.value > 0).length,
  };
}

/**
 * 貢献バーの長さ（0〜1）。いちばん多い人が満杯になるように正規化する。
 * app.js: raidContributionRatio
 */
export function raidContributionRatio(value: number, maxValue: number): number {
  if (!(maxValue > 0)) return 0;
  return Math.min(1, Math.max(0, value / maxValue));
}

// ---------------------------------------------------------------------
// 週の積み上げ得点（レイドモードの成績表）
// ---------------------------------------------------------------------

/** 集計に渡す投稿。Firestore の型に依存しないよう Date で受ける。 */
export interface RaidPost {
  userId: string;
  exerciseType: string;
  value: number;
  /** 投稿時刻。JST の暦日でどの日のぶんか決める */
  date: Date;
}

export interface RaidDayEntry {
  userId: string;
  userName: string;
  /** その日の合計回数 */
  value: number;
  /** その日の全体に占める割合（0〜1） */
  share: number;
  /** 貢献度をそのまま点にしたもの（share × RAID_POINTS_PER_DAY） */
  points: number;
  isMe: boolean;
}

export interface RaidDayResult {
  dateKey: string;
  day: number;
  /** その日の種目。引き当てられなければ null（レイドを行わない日） */
  exerciseKey: string | null;
  /**
   * その日の目標。通算ブロックの日は 0（目標はブロック側にあり、
   * 1日で区切った目標というものが存在しないため）。
   */
  goal: number;
  /** 1人あたりの目標（人数割の日のみ）。ブロックの日は null */
  perPerson: number | null;
  /** 目標の掛け算に使った人数 */
  memberCount: number;
  totalValue: number;
  /** その日だけで達成したか。ブロックの日は常に false（判定はブロック単位） */
  cleared: boolean;
  /** 通算ブロックの日はその id。単独開催の日は null */
  blockId: string | null;
  /** 点の高い順。0回の人は含めない（成績表なので参加者だけ並べる） */
  entries: RaidDayEntry[];
}

/** 通算ブロック1つぶんの結果（成績表の「通算」カード）。 */
export interface RaidBlockResult {
  id: string;
  title: string;
  label: string;
  startDateKey: string;
  endDateKey: string;
  /** ブロックの日数 */
  dayCount: number;
  /** 集計に入った日数（＝今日までに来た日） */
  playedDays: number;
  /** ブロックの種目（最後に引き当てられた日のもの） */
  exerciseKey: string | null;
  /** ブロック全体の目標 */
  goal: number;
  /** 1人あたりの通算目標（全日が人数割のときだけ） */
  perPersonTotal: number | null;
  memberCount: number;
  /** 期間ぶんの通算 */
  totalValue: number;
  percent: number;
  cleared: boolean;
  /**
   * 通算の多い順。value は期間の合計回数、points は日ごとに分け合った点の合計。
   * share は期間の合計に占める割合。
   */
  entries: RaidDayEntry[];
}

export interface RaidStanding {
  userId: string;
  userName: string;
  /** 期間中の合計点 */
  totalPoints: number;
  /** 1回以上投稿した日数 */
  activeDays: number;
  /** 日付キー → その日の点（0点の日は入らない） */
  perDay: Record<string, number>;
  /** 同点は同順位（競技順位） */
  rank: number;
  isMe: boolean;
}

/**
 * 投稿を「レイドの日 × ユーザー」で合計する。
 * その日の種目に一致する投稿だけを数える（種目が決まっていない日は空）。
 * @param dayExerciseKeys 日付キー → その日の種目キー
 * @returns 日付キー → userId → 合計回数
 */
export function bucketRaidTotals(
  posts: RaidPost[],
  dayExerciseKeys: Record<string, string>,
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  (posts || []).forEach((post) => {
    if (!post || !post.date) return;
    const dateKey = getDailyDateKeyJST(post.date);
    const exerciseKey = dayExerciseKeys[dateKey];
    if (!exerciseKey || post.exerciseType !== exerciseKey) return;
    const v = Number(post.value) || 0;
    if (v <= 0) return;
    if (!out[dateKey]) out[dateKey] = {};
    out[dateKey][post.userId] = (out[dateKey][post.userId] || 0) + v;
  });
  return out;
}

/** 表示名の解決（一覧に無いユーザーでも空欄にしない）。 */
function raidUserName(
  usersMap: Record<string, { userName?: string; email?: string }>,
  userId: string,
): string {
  const u = (usersMap || {})[userId] || {};
  return u.userName || u.email || '名無しさん';
}

/**
 * 1日ぶんの結果を組み立てる。
 * 点は「その日の合計に対する貢献度」なので、参加者の点の合計は
 * 誰か1人でも投稿していれば必ず RAID_POINTS_PER_DAY になる。
 */
export function buildRaidDayResult(
  config: RaidDayConfig,
  exerciseKey: string | null,
  totals: Record<string, number>,
  usersMap: Record<string, { userName?: string; email?: string }>,
  myUserId: string,
  /**
   * ボスの体力の掛け算に使う人数＝**前日**に記録したログイン人数。
   * 記録が無ければ「その日に投稿した人数」で代用する（過去のログイン
   * 状況はもう復元できないため、分かる範囲でいちばん近い数）。
   */
  recordedMemberCount?: number,
): RaidDayResult {
  const rows = Object.keys(totals || {})
    .map((userId) => ({ userId, value: Number(totals[userId]) || 0 }))
    .filter((r) => r.value > 0);
  const totalValue = rows.reduce((sum, r) => sum + r.value, 0);

  const entries: RaidDayEntry[] = rows
    .map((r) => {
      const share = totalValue > 0 ? r.value / totalValue : 0;
      return {
        userId: r.userId,
        userName: raidUserName(usersMap, r.userId),
        value: r.value,
        share,
        points: share * RAID_POINTS_PER_DAY,
        isMe: r.userId === myUserId,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        a.userName.localeCompare(b.userName) ||
        a.userId.localeCompare(b.userId),
    );

  const memberCount =
    recordedMemberCount && recordedMemberCount > 0
      ? recordedMemberCount
      : entries.length;
  // 通算ブロックの日は1日ぶんの目標を持たない。ここで per-day の目標を作ると
  // 「その日だけで未達」という、ブロックには存在しない判定が画面に出てしまう
  const inBlock = !!config.blockId;
  const goal = inBlock ? 0 : resolveRaidGoal(config, memberCount);

  return {
    dateKey: config.dateKey,
    day: config.day,
    exerciseKey,
    goal,
    perPerson: !inBlock && config.perPerson != null ? config.perPerson : null,
    memberCount,
    totalValue,
    cleared: goal > 0 && totalValue >= goal,
    blockId: config.blockId || null,
    entries,
  };
}

/**
 * ブロックの日ごとの結果を通算にまとめる。
 * 回数は期間の合計、点は日ごとに分け合ったものの合計。
 * 討伐判定はここでだけ行う（1日ごとには判定しない）。
 */
export function buildRaidBlockResult(
  plan: RaidBlockPlan,
  /** ブロックに属する日の結果（日付順・今日までのぶん） */
  dayResults: RaidDayResult[],
  /** ブロック初日の前日に記録したログイン人数 */
  memberCount: number,
  usersMap: Record<string, { userName?: string; email?: string }>,
  myUserId: string,
): RaidBlockResult {
  const acc: Record<string, { value: number; points: number }> = {};
  dayResults.forEach((day) => {
    day.entries.forEach((e) => {
      if (!acc[e.userId]) acc[e.userId] = { value: 0, points: 0 };
      acc[e.userId].value += e.value;
      acc[e.userId].points += e.points;
    });
  });

  const totalValue = Object.values(acc).reduce((sum, r) => sum + r.value, 0);
  const entries: RaidDayEntry[] = Object.keys(acc)
    .map((userId) => ({
      userId,
      userName: raidUserName(usersMap, userId),
      value: acc[userId].value,
      share: totalValue > 0 ? acc[userId].value / totalValue : 0,
      points: acc[userId].points,
      isMe: userId === myUserId,
    }))
    .sort(
      (a, b) =>
        b.value - a.value ||
        a.userName.localeCompare(b.userName) ||
        a.userId.localeCompare(b.userId),
    );

  const goal = resolveRaidBlockGoal(plan, memberCount);
  // 最後に種目が決まっている日のものを代表にする（3日とも同じ種目のため）
  const exerciseKey =
    [...dayResults].reverse().find((d) => !!d.exerciseKey)?.exerciseKey || null;

  return {
    id: plan.block.id,
    title: plan.block.title,
    label: plan.block.label,
    startDateKey: plan.block.dateKeys[0],
    endDateKey: plan.block.dateKeys[plan.block.dateKeys.length - 1],
    dayCount: plan.block.dateKeys.length,
    playedDays: dayResults.length,
    exerciseKey,
    goal,
    perPersonTotal: raidBlockPerPerson(plan),
    memberCount,
    totalValue,
    percent: goal > 0 ? Math.min(100, Math.round((totalValue / goal) * 100)) : 0,
    cleared: goal > 0 && totalValue >= goal,
    entries,
  };
}

/**
 * 日ごとの結果を足し上げて成績表にする。
 * 同点は同順位（1,2,2,4…）。並び順は点の高い順で、
 * 同点なら名前・IDで安定させる（どの端末でも同じ並びにするため）。
 */
export function buildRaidStandings(
  dayResults: RaidDayResult[],
  usersMap: Record<string, { userName?: string; email?: string }>,
  myUserId: string,
): RaidStanding[] {
  const acc: Record<string, RaidStanding> = {};

  (dayResults || []).forEach((day) => {
    day.entries.forEach((e) => {
      if (!acc[e.userId]) {
        acc[e.userId] = {
          userId: e.userId,
          userName: raidUserName(usersMap, e.userId),
          totalPoints: 0,
          activeDays: 0,
          perDay: {},
          rank: 0,
          isMe: e.userId === myUserId,
        };
      }
      const row = acc[e.userId];
      row.totalPoints += e.points;
      row.activeDays += 1;
      row.perDay[day.dateKey] = e.points;
    });
  });

  const list = Object.values(acc).sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      a.userName.localeCompare(b.userName) ||
      a.userId.localeCompare(b.userId),
  );

  // 同点は同順位。次の順位は人数ぶん飛ばす（競技順位）
  let rank = 0;
  let prev: number | null = null;
  list.forEach((row, i) => {
    if (prev === null || Math.abs(row.totalPoints - prev) > 1e-9) {
      rank = i + 1;
    }
    prev = row.totalPoints;
    row.rank = rank;
  });
  return list;
}

/** 点の表示。小数1桁（整数なら小数を出さない）。 */
export function formatRaidPoints(points: number): string {
  const n = Number(points) || 0;
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
