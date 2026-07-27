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
  resolveDailyPeak,
  sumDailyTotals,
  type DailyMission,
  type DailyMissionState,
} from './daily-mission';
import type { FreeExerciseMap, Post, UserData } from './types';

const SETTINGS = 'settings_free';
const MISSION_DOC = 'daily_mission';
const POSTS = 'posts_free';

interface MissionDoc {
  dateKey?: string;
  exerciseKey?: string;
  recentKeys?: string[];
  peak?: number;
  bestValue?: number;
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

  /** 過去最高回数を引く。失敗したら既定ピークにフォールバック。 */
  const resolveBest = async (key: string) => {
    try {
      return await getExerciseBestValue(key, getDailyBoundariesJST(dateKey).start);
    } catch (e) {
      console.warn('[デイリーミッション] 過去最高回数の取得に失敗:', e);
      return 0;
    }
  };

  // 当日分が既にあり、その種目が今も存在すればそれを使う
  if (
    saved.dateKey === dateKey &&
    saved.exerciseKey &&
    freeExercises[saved.exerciseKey]
  ) {
    // 旧バージョンが書いたドキュメントには bestValue が無いので、その場合だけ引き直す
    if (typeof saved.bestValue === 'number') {
      return toMission(dateKey, saved.exerciseKey, saved.bestValue);
    }
    const bestValue = await resolveBest(saved.exerciseKey);
    try {
      await setDoc(ref, { bestValue, peak: resolveDailyPeak(bestValue) }, { merge: true });
    } catch {
      // 書けなくても各端末で同じ値を再計算できる
    }
    return toMission(dateKey, saved.exerciseKey, bestValue);
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
        bestValue,
        peak: resolveDailyPeak(bestValue),
        recentKeys: pushRecentMissionKeys(recentKeys, exerciseKey),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e) {
    console.warn('[デイリーミッション] 保存失敗（表示は続行）:', e);
  }

  return toMission(dateKey, exerciseKey, bestValue);
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
  const mission = await getOrCreateDailyMission(freeExercises, now);
  if (!mission) return null;

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

  // 自分が usersMap に無い場合（初回ログイン直後など）も必ず並べる
  const users: Record<string, UserData> = { ...usersMap };
  if (!users[userId]) users[userId] = {};

  const participants = buildDailyParticipants({
    usersMap: users,
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
  };
}
