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
  getDailyBoundariesJST,
  getDailyDateKeyJST,
  generateDailyMissionTarget,
  pickDailyMissionExercise,
  pushRecentMissionKeys,
  type DailyMission,
  type DailyMissionState,
} from './daily-mission';
import type { FreeExerciseMap, Post } from './types';

const SETTINGS = 'settings_free';
const MISSION_DOC = 'daily_mission';
const POSTS = 'posts_free';

interface MissionDoc {
  dateKey?: string;
  exerciseKey?: string;
  recentKeys?: string[];
}

/**
 * 今日のミッションを取得。未生成なら生成して保存する（冪等）。
 * 選出は日付キーだけをシードにする決定的処理なので、保存に失敗しても
 * 全ユーザーで同じ種目になり表示は破綻しない。
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

  // 当日分が既にあり、その種目が今も存在すればそれを使う
  if (
    saved.dateKey === dateKey &&
    saved.exerciseKey &&
    freeExercises[saved.exerciseKey]
  ) {
    return { dateKey, exerciseKey: saved.exerciseKey };
  }

  const recentKeys = Array.isArray(saved.recentKeys) ? saved.recentKeys : [];
  const exerciseKey = pickDailyMissionExercise(
    dateKey,
    freeExercises,
    recentKeys,
  );
  if (!exerciseKey) return null;

  try {
    await setDoc(
      ref,
      {
        dateKey,
        exerciseKey,
        recentKeys: pushRecentMissionKeys(recentKeys, exerciseKey),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e) {
    console.warn('[デイリーミッション] 保存失敗（表示は続行）:', e);
  }

  return { dateKey, exerciseKey };
}

/**
 * その日の自分の最高記録を取得。timestamp の単一フィールド範囲検索だけで
 * 済ませ（複合インデックス不要）、userId / exerciseType はクライアント側で絞る。
 * app.js: getDailyMissionBestValue
 */
export async function getDailyMissionBestValue(
  userId: string,
  dateKey: string,
  exerciseKey: string,
): Promise<number> {
  const { start, end } = getDailyBoundariesJST(dateKey);
  const snap = await getDocs(
    query(
      collection(db, POSTS),
      where('timestamp', '>=', Timestamp.fromDate(start)),
      where('timestamp', '<', Timestamp.fromDate(end)),
    ),
  );
  let best = 0;
  snap.docs.forEach((d) => {
    const post = d.data() as Post;
    if (post.userId !== userId) return;
    if (post.exerciseType !== exerciseKey) return;
    const v = Number(post.value) || 0;
    if (v > best) best = v;
  });
  return best;
}

/** ミッション本体＋自分の達成状況をまとめて解決。app.js: loadDailyMissionState */
export async function loadDailyMissionState(
  userId: string,
  freeExercises: FreeExerciseMap,
  now: Date = new Date(),
): Promise<DailyMissionState | null> {
  const mission = await getOrCreateDailyMission(freeExercises, now);
  if (!mission) return null;

  const target = generateDailyMissionTarget(
    userId,
    mission.dateKey,
    mission.exerciseKey,
  );
  let bestValue = 0;
  try {
    bestValue = await getDailyMissionBestValue(
      userId,
      mission.dateKey,
      mission.exerciseKey,
    );
  } catch (e) {
    console.warn('[デイリーミッション] クリア判定に失敗:', e);
  }

  return {
    dateKey: mission.dateKey,
    exerciseKey: mission.exerciseKey,
    target,
    bestValue,
    cleared: bestValue >= target,
  };
}
