// =====================================================================
// デイリーミッション Firestore オーケストレーション
// ⚠️ 既存 app.js の同名関数のミラー。両アプリが同じ
//    settings_free/daily_mission と posts_free を読み書きするため、
//    ドキュメント名・フィールド形状・冪等条件を変更しないこと。
// =====================================================================
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  buildDailyParticipants,
  dailyTargetProbability,
  getDailyBoundariesJST,
  getDailyDateKeyJST,
  generateDailyMissionTarget,
  pickDailyMissionExercise,
  pushRecentMissionKeys,
  readCachedBestValue,
  resolveDailyPeak,
  sumDailyTotals,
  type DailyMission,
  type DailyMissionState,
} from './daily-mission';
import {
  applyRaidGoalOverride,
  bucketRaidTotals,
  buildRaidDayResult,
  buildRaidProgress,
  buildRaidStandings,
  getRaidDayConfig,
  isRaidMaintenanceDay,
  resolveRaidExerciseKey,
  sanitizeRaidExerciseOverrides,
  sanitizeRaidGoalOverrides,
  sanitizeRaidMemberCounts,
  countActiveUsersSince,
  getPreviousDateKey,
  RAID_CONFIG_DOC,
  RAID_SCHEDULE,
  type RaidDayResult,
  type RaidOverrides,
  type RaidStanding,
} from './raid-mode';
import type { FreeExerciseMap, Post, UserData } from './types';

const SETTINGS = 'settings_free';
const MISSION_DOC = 'daily_mission';
const POSTS = 'posts_free';

interface MissionDoc {
  dateKey?: string;
  exerciseKey?: string;
  recentKeys?: string[];
  peak?: number | null;
  bestValue?: number | null;
  /** bestValue がどの種目・どの日の締めで数えた値か（取り違え防止） */
  bestValueKey?: string | null;
  bestValueDateKey?: string | null;
  /** レイド開催日に記録する何日目か・目標回数（表示には使わず記録用） */
  raidDay?: number | null;
  raidGoal?: number | null;
}

/**
 * 管理画面で設定された上書き（目標回数・種目）を読む。
 * 読めなければ空（＝コードの既定）で進める。ここで失敗して
 * レイドごと落とすより、既定の設定で開催を続けたほうが害が小さい。
 * app.js: getRaidOverrides
 */
export async function getRaidOverrides(): Promise<RaidOverrides> {
  try {
    const snap = await getDoc(doc(db, SETTINGS, RAID_CONFIG_DOC));
    if (!snap.exists()) return { goals: {}, exercises: {}, memberCounts: {} };
    const data = snap.data() as {
      goals?: unknown;
      exercises?: unknown;
      memberCounts?: unknown;
    };
    return {
      goals: sanitizeRaidGoalOverrides(data.goals),
      exercises: sanitizeRaidExerciseOverrides(data.exercises),
      memberCounts: sanitizeRaidMemberCounts(data.memberCounts),
    };
  } catch (e) {
    console.warn('[レイド] 管理画面の設定を読めませんでした（既定で続行）:', e);
    return { goals: {}, exercises: {}, memberCounts: {} };
  }
}

/**
 * その日のログイン人数を記録する（増えたときだけ書く）。
 *
 * ボスの体力が「前日のログイン人数 × 1人あたり」で決まるので、
 * 翌日そのぶんを引けるように毎日残しておく必要がある。
 * `users.lastActiveDateKey` は最後に開いた日しか持たず、後から
 * 「その日ログインしていた人」を数え直せないため、開催中に見えた
 * 最大人数をここで確定させる。
 * app.js: recordRaidMemberCount
 */
export async function recordRaidMemberCount(
  dateKey: string,
  memberCount: number,
  known: Record<string, number>,
): Promise<void> {
  if (!(memberCount > 0)) return;
  if ((known[dateKey] || 0) >= memberCount) return;
  try {
    await setDoc(
      doc(db, SETTINGS, RAID_CONFIG_DOC),
      { memberCounts: { [dateKey]: memberCount } },
      { merge: true },
    );
  } catch (e) {
    // 書けなくても当日の表示は出せる（成績表の目標が投稿者数基準になるだけ）
    console.warn('[レイド] 人数の記録に失敗:', e);
  }
}

/** 個人目標の抽選を行わない日（レイド）のミッション。 */
function toRaidMission(
  dateKey: string,
  exerciseKey: string,
  raid: ReturnType<typeof getRaidDayConfig>,
): DailyMission {
  return {
    dateKey,
    exerciseKey,
    peak: 0,
    bestValue: 0,
    peakSource: 'default',
    raid,
  };
}

/**
 * その種目の過去最高回数（ユーザーをまたいだ全投稿の最大値）。
 * 当日ぶんは除外する。含めると、その日の投稿でピークが動いて
 * 全員の目標が途中で変わってしまうため。
 * exerciseType の等値だけで引き（複合インデックス不要）、日付は手元で絞る。
 * app.js: getExerciseBestValue
 */
export async function getExerciseBestValue(
  exerciseKey: string,
  before: Date,
): Promise<number> {
  const snap = await getDocs(
    query(collection(db, POSTS), where('exerciseType', '==', exerciseKey)),
  );
  let best = 0;
  snap.docs.forEach((d) => {
    const post = d.data() as Post;
    const ts = post.timestamp?.toDate?.();
    // timestamp 未確定（serverTimestamp 反映待ち）＝ついさっきの投稿なので除外
    if (!ts || ts >= before) return;
    const v = Number(post.value) || 0;
    if (v > best) best = v;
  });
  return best;
}

/** 保存済みの値・過去最高から、その日のピーク回数を組み立てる。 */
function toMission(
  dateKey: string,
  exerciseKey: string,
  bestValue: number,
): DailyMission {
  const best = Number(bestValue) || 0;
  return {
    dateKey,
    exerciseKey,
    peak: resolveDailyPeak(best),
    bestValue: best,
    peakSource: best > 0 ? 'best' : 'default',
  };
}

/**
 * 今日のミッションを取得。未生成なら生成して保存する（冪等）。
 * 選出は日付キーだけをシードにする決定的処理なので、保存に失敗しても
 * 全ユーザーで同じ種目になり表示は破綻しない。ピーク回数も当日ぶんを
 * 除いた過去最高から決まるため、どの端末でも同じ値になる。
 * app.js: getOrCreateDailyMission
 */
export async function getOrCreateDailyMission(
  freeExercises: FreeExerciseMap,
  now: Date = new Date(),
  /** 呼び出し側で既に読んでいれば渡す（同じ設定を二度読まないため）。 */
  presetOverrides?: RaidOverrides,
): Promise<DailyMission | null> {
  const dateKey = getDailyDateKeyJST(now);
  const ref = doc(db, SETTINGS, MISSION_DOC);

  let saved: MissionDoc = {};
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) saved = snap.data() as MissionDoc;
  } catch (e) {
    console.warn('[デイリーミッション] 取得失敗、ローカル生成にフォールバック:', e);
  }

  // レイド開催日: 個人目標の抽選も過去最高回数の集計も要らないので先に返す。
  // 種目が引き当てられない（対象の種目が未登録）日は通常のミッションに戻す。
  const scheduled = getRaidDayConfig(dateKey);
  if (scheduled) {
    // 種目・目標回数とも管理画面で上書きできる。毎回読み直すので、
    // 開催中に変更してもリロードだけで全員に反映される
    const overrides = presetOverrides || (await getRaidOverrides());
    const raidKey = resolveRaidExerciseKey(
      scheduled,
      freeExercises,
      overrides.exercises,
    );
    if (raidKey) {
      const raidConfig = applyRaidGoalOverride(scheduled, overrides.goals);
      // 書き込みは日付が変わった1回だけ（recentKeys を毎回積み増さないため）
      if (saved.dateKey !== dateKey) {
        const prevKeys = Array.isArray(saved.recentKeys) ? saved.recentKeys : [];
        try {
          await setDoc(
            ref,
            {
              dateKey,
              exerciseKey: raidKey,
              raidDay: raidConfig.day,
              raidGoal: raidConfig.goal,
              recentKeys: pushRecentMissionKeys(prevKeys, raidKey),
              // 個人目標を使わない日なので、前日のピーク情報は残さず潰す
              peak: null,
              bestValue: null,
              bestValueKey: null,
              bestValueDateKey: null,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        } catch (e) {
          console.warn('[レイド] 保存失敗（表示は続行）:', e);
        }
      }
      return toRaidMission(dateKey, raidKey, raidConfig);
    }
    console.warn(
      '[レイド] 対象種目が見つからないため通常のデイリーミッションで進めます:',
      scheduled.nameHints,
    );
  }

  /**
   * 過去最高回数を引く。引けなかったら null を返す（0 と区別する）。
   * 失敗を 0 として保存すると、その日いっぱい既定ピークのまま固定されてしまう。
   */
  const resolveBest = async (key: string): Promise<number | null> => {
    try {
      return await getExerciseBestValue(key, getDailyBoundariesJST(dateKey).start);
    } catch (e) {
      console.warn('[デイリーミッション] 過去最高回数の取得に失敗:', e);
      return null;
    }
  };

  /**
   * 過去最高回数を「どの種目・どの日の値か」とセットで書くためのフィールド。
   * 引けなかったときは古い値を残さず null で潰し、次の読み込みで引き直させる。
   */
  const bestFields = (key: string, bestValue: number | null): MissionDoc =>
    bestValue == null
      ? { bestValue: null, bestValueKey: null, bestValueDateKey: null, peak: null }
      : {
          bestValue,
          bestValueKey: key,
          bestValueDateKey: dateKey,
          peak: resolveDailyPeak(bestValue),
        };

  // 当日分が既にあり、その種目が今も存在すればそれを使う
  if (
    saved.dateKey === dateKey &&
    saved.exerciseKey &&
    freeExercises[saved.exerciseKey]
  ) {
    const savedKey = saved.exerciseKey;
    // 今日のこの種目の値だと確認できたときだけキャッシュを使う。
    // 別種目・別日の値や旧バージョンの書き込みは信用せず引き直す。
    const cached = readCachedBestValue(saved, dateKey, savedKey);
    if (cached != null) return toMission(dateKey, savedKey, cached);

    const bestValue = await resolveBest(savedKey);
    try {
      await setDoc(ref, bestFields(savedKey, bestValue), { merge: true });
    } catch {
      // 書けなくても各端末で同じ値を再計算できる
    }
    return toMission(dateKey, savedKey, bestValue ?? 0);
  }

  const recentKeys = Array.isArray(saved.recentKeys) ? saved.recentKeys : [];
  const exerciseKey = pickDailyMissionExercise(
    dateKey,
    freeExercises,
    recentKeys,
  );
  if (!exerciseKey) return null;

  const bestValue = await resolveBest(exerciseKey);

  try {
    await setDoc(
      ref,
      {
        dateKey,
        exerciseKey,
        ...bestFields(exerciseKey, bestValue),
        recentKeys: pushRecentMissionKeys(recentKeys, exerciseKey),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e) {
    console.warn('[デイリーミッション] 保存失敗（表示は続行）:', e);
  }

  return toMission(dateKey, exerciseKey, bestValue ?? 0);
}

/**
 * その日の「全ユーザー」の合計回数を userId→合計 で返す。
 * 1回で目標に届かなくても、その日の投稿を積み上げて達成できる。
 * timestamp の単一フィールド範囲検索だけで済ませ（複合インデックス不要）、
 * exerciseType の絞り込みはクライアント側で行う。1クエリで全員分そろう。
 * app.js: getDailyMissionTotals
 */
export async function getDailyMissionTotals(
  dateKey: string,
  exerciseKey: string,
): Promise<Record<string, number>> {
  const { start, end } = getDailyBoundariesJST(dateKey);
  const snap = await getDocs(
    query(
      collection(db, POSTS),
      where('timestamp', '>=', Timestamp.fromDate(start)),
      where('timestamp', '<', Timestamp.fromDate(end)),
    ),
  );
  return sumDailyTotals(
    snap.docs.map((d) => d.data() as Post),
    exerciseKey,
  );
}

/**
 * ミッション本体＋自分の達成状況＋全員の目標をまとめて解決。
 * 目標はシードから決まるので、他ユーザーの回数を保存・取得する必要はない。
 * app.js: loadDailyMissionState
 */
export async function loadDailyMissionState(
  userId: string,
  freeExercises: FreeExerciseMap,
  usersMap: Record<string, UserData> = {},
  now: Date = new Date(),
): Promise<DailyMissionState | null> {
  // レイド開始前のメンテナンス日はミッションを出さず、告知だけを返す。
  const maintenanceDateKey = getDailyDateKeyJST(now);
  if (isRaidMaintenanceDay(maintenanceDateKey)) {
    return {
      dateKey: maintenanceDateKey,
      exerciseKey: '',
      target: 0,
      // 未クリア扱いにして、タブのドット・起動時の自動遷移で告知を届ける
      cleared: false,
      totalValue: 0,
      probability: 0,
      peak: 0,
      bestValue: 0,
      peakSource: 'default',
      participants: [],
      raid: null,
      maintenance: true,
    };
  }

  // レイド日は設定と人数記録の両方でこれを使うので、1回だけ読む
  const overrides = getRaidDayConfig(maintenanceDateKey)
    ? await getRaidOverrides()
    : undefined;

  const mission = await getOrCreateDailyMission(freeExercises, now, overrides);
  if (!mission) return null;

  // 自分が usersMap に無い場合（初回ログイン直後など）も必ず並べる
  const usersWithMe: Record<string, UserData> = { ...usersMap };
  if (!usersWithMe[userId]) usersWithMe[userId] = {};

  // レイド開催日: 個人目標は無く、全員の合計だけで達成を判定する
  if (mission.raid) {
    let raidTotals: Record<string, number> = {};
    try {
      raidTotals = await getDailyMissionTotals(
        mission.dateKey,
        mission.exerciseKey,
      );
    } catch (e) {
      console.warn('[レイド] 集計に失敗:', e);
    }
    const raid = buildRaidProgress({
      usersMap: usersWithMe,
      dateKey: mission.dateKey,
      totals: raidTotals,
      myUserId: userId,
      config: mission.raid,
      memberCounts: overrides?.memberCounts,
    });
    // 翌日のボス体力に使うので、今日ログインした人数を毎日残す
    // （固定目標の日でも、その翌日が人数割なら必要になる）
    void recordRaidMemberCount(
      mission.dateKey,
      countActiveUsersSince(usersWithMe, mission.dateKey),
      overrides?.memberCounts || {},
    );
    return {
      dateKey: mission.dateKey,
      exerciseKey: mission.exerciseKey,
      target: 0,
      totalValue: raid.myValue,
      // レイド中の「クリア済み」は自分が今日1回でも積んだか（タブのドット用）
      cleared: raid.myValue > 0,
      probability: 0,
      peak: 0,
      bestValue: 0,
      peakSource: 'default',
      participants: [],
      raid,
      maintenance: false,
    };
  }

  const target = generateDailyMissionTarget(
    userId,
    mission.dateKey,
    mission.exerciseKey,
    mission.peak,
  );

  let totals: Record<string, number> = {};
  try {
    totals = await getDailyMissionTotals(mission.dateKey, mission.exerciseKey);
  } catch (e) {
    console.warn('[デイリーミッション] クリア判定に失敗:', e);
  }

  const participants = buildDailyParticipants({
    usersMap: usersWithMe,
    dateKey: mission.dateKey,
    exerciseKey: mission.exerciseKey,
    totals,
    myUserId: userId,
    peak: mission.peak,
  });

  const totalValue = totals[userId] || 0;
  return {
    dateKey: mission.dateKey,
    exerciseKey: mission.exerciseKey,
    target,
    totalValue,
    cleared: totalValue >= target,
    probability: dailyTargetProbability(target, mission.peak),
    peak: mission.peak,
    bestValue: mission.bestValue,
    peakSource: mission.peakSource,
    participants,
    raid: null,
    maintenance: false,
  };
}

// ---------------------------------------------------------------------
// レイドの積み上げ得点（レイドモードの成績表）
// ---------------------------------------------------------------------

export interface RaidScoreboard {
  /** 開催済みの日だけ（今日を含む）。新しい日が先頭 */
  days: RaidDayResult[];
  standings: RaidStanding[];
  /** 開催済み日数 */
  playedDays: number;
}

/**
 * レイド期間の投稿をまとめて取り、日ごとの結果と積み上げ得点を作る。
 * 期間ぶんを1クエリで引いて手元で日別に振り分けるので、
 * 日数が増えても読み取りは1回のまま（複合インデックスも要らない）。
 * app.js: loadRaidScoreboard
 */
export async function loadRaidScoreboard(
  userId: string,
  freeExercises: FreeExerciseMap,
  usersMap: Record<string, UserData> = {},
  now: Date = new Date(),
): Promise<RaidScoreboard> {
  const todayKey = getDailyDateKeyJST(now);
  // まだ来ていない日は集計しない（0点の行が並ぶだけなので）
  const played = RAID_SCHEDULE.filter((d) => d.dateKey <= todayKey);
  if (played.length === 0) {
    return { days: [], standings: [], playedDays: 0 };
  }

  const overrides = await getRaidOverrides();
  const exerciseKeyByDate: Record<string, string> = {};
  const resolved = played.map((config) => {
    const key = resolveRaidExerciseKey(
      config,
      freeExercises,
      overrides.exercises,
    );
    if (key) exerciseKeyByDate[config.dateKey] = key;
    return { config: applyRaidGoalOverride(config, overrides.goals), key };
  });

  // 期間の投稿を1クエリで取得（timestamp の単一フィールド範囲検索のみ）
  const rangeStart = getDailyBoundariesJST(played[0].dateKey).start;
  const rangeEnd = getDailyBoundariesJST(played[played.length - 1].dateKey).end;
  let posts: Array<{
    userId: string;
    exerciseType: string;
    value: number;
    date: Date;
  }> = [];
  try {
    const snap = await getDocs(
      query(
        collection(db, POSTS),
        where('timestamp', '>=', Timestamp.fromDate(rangeStart)),
        where('timestamp', '<', Timestamp.fromDate(rangeEnd)),
      ),
    );
    posts = snap.docs
      .map((d) => d.data() as Post)
      .map((p) => ({
        userId: p.userId,
        exerciseType: p.exerciseType,
        value: Number(p.value) || 0,
        // timestamp 未確定（serverTimestamp 反映待ち）の投稿は日を決められない
        date: p.timestamp?.toDate?.() as Date,
      }))
      .filter((p) => !!p.date);
  } catch (e) {
    console.warn('[レイド] 得点の集計に失敗:', e);
  }

  const totalsByDay = bucketRaidTotals(posts, exerciseKeyByDate);

  const users: Record<string, UserData> = { ...usersMap };
  if (!users[userId]) users[userId] = {};

  const days = resolved.map(({ config, key }) =>
    buildRaidDayResult(
      config,
      key,
      totalsByDay[config.dateKey] || {},
      users,
      userId,
      // ボスの体力は前日のログイン人数で決まる
      overrides.memberCounts[getPreviousDateKey(config.dateKey)],
    ),
  );

  return {
    days: [...days].reverse(),
    standings: buildRaidStandings(days, users, userId),
    playedDays: days.length,
  };
}
