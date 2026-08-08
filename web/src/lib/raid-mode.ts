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
import { getDailyDateKeyJST, isDailyActiveUser } from './daily-mission';
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

/** 管理画面で設定できるレイドの上書き一式。 */
export interface RaidOverrides {
  goals: RaidGoalOverrides;
  exercises: RaidExerciseOverrides;
}

/** レイド1日ぶんの設定。 */
export interface RaidDayConfig {
  /** JST 日付キー 'YYYY-MM-DD' */
  dateKey: string;
  /** 何日目か（1始まり） */
  day: number;
  /**
   * 種目の探し方。登録種目の「名前」に対する部分一致候補を優先順に並べる。
   * フリー種目のキーは 'free_<timestamp>' で環境ごとに違うため、
   * キー直指定ではなく名前で引き当てる。
   */
  nameHints: string[];
  /** その日みんなで積み上げる合計の目標（上書き適用後の実効値）。 */
  goal: number;
  /** カードに出す一言。 */
  label: string;
  /** goal がどこから来たか。applyRaidGoalOverride を通したときだけ入る。 */
  goalSource?: RaidGoalSource;
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
  return { ...config, goal: override, goalSource: 'override' };
}

/**
 * レイドの日程表。
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
    goal: 1000,
    label: '開幕戦。まずは全員で1000回。',
  },
  {
    dateKey: '2026-08-10',
    day: 2,
    nameHints: ['スクワット', 'squat'],
    goal: 1500,
    label: '下半身デー。数で押し切ろう。',
  },
  {
    dateKey: '2026-08-11',
    day: 3,
    nameHints: ['腹筋', 'シットアップ', 'クランチ', 'アブ', 'sit'],
    goal: 1500,
    label: '体幹デー。すきま時間で積み上げ。',
  },
  {
    dateKey: '2026-08-12',
    day: 4,
    nameHints: ['懸垂', 'チンニング', 'プルアップ', 'pull'],
    goal: 300,
    label: '難関。1回の重みが大きい日。',
  },
  {
    dateKey: '2026-08-13',
    day: 5,
    nameHints: ['ディップス', 'dip'],
    goal: 600,
    label: '押す種目でもう一押し。',
  },
  {
    dateKey: '2026-08-14',
    day: 6,
    nameHints: ['バーピー', 'burpee'],
    goal: 800,
    label: '全身デー。息が上がる。',
  },
  {
    dateKey: '2026-08-15',
    day: 7,
    nameHints: ['ランジ', 'lunge'],
    goal: 1200,
    label: '最終日前夜。左右の合計でOK。',
  },
  {
    dateKey: '2026-08-16',
    day: 8,
    // 「腕立て」だけだと派生種目（腕立てジャンプ等）も拾うので、
    // 素の種目に付きやすい名前を先に見る
    nameHints: ['プッシュアップ', '腕立て伏せ', '腕立て', 'push'],
    goal: 2000,
    label: '最終決戦。初日の倍を全員で。',
  },
];

/** レイド全体の日数。 */
export const RAID_TOTAL_DAYS = RAID_SCHEDULE.length;

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

export interface RaidProgress {
  day: number;
  totalDays: number;
  goal: number;
  /** goal がコードの既定か管理画面での設定か */
  goalSource: RaidGoalSource;
  label: string;
  /** 全員の当日合計 */
  totalValue: number;
  /** 目標までの残り（達成済みなら 0） */
  remaining: number;
  /** 達成率（0〜100 に丸め込んだ整数） */
  percent: number;
  cleared: boolean;
  /** 自分のその日の合計 */
  myValue: number;
  /** 貢献の多い順。0回の人も並べる（誰が未着手か分かるように） */
  contributors: RaidContributor[];
  /** 1回以上投稿した人数 */
  activeCount: number;
}

export interface BuildRaidProgressInput {
  usersMap: Record<string, { userName?: string; email?: string; lastActiveDateKey?: string }>;
  dateKey: string;
  /** 当日の投稿から作った userId→合計回数 */
  totals: Record<string, number>;
  myUserId: string;
  config: RaidDayConfig;
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
}: BuildRaidProgressInput): RaidProgress {
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

  const goal = config.goal;
  return {
    day: config.day,
    totalDays: RAID_TOTAL_DAYS,
    goal,
    goalSource: config.goalSource || 'default',
    label: config.label,
    totalValue,
    remaining: Math.max(0, goal - totalValue),
    percent: goal > 0 ? Math.min(100, Math.round((totalValue / goal) * 100)) : 0,
    cleared: goal > 0 && totalValue >= goal,
    myValue: Number(totals[myUserId]) || 0,
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
