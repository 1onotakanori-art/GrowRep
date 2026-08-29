// =====================================================================
// 週間チャレンジ Firestore オーケストレーション
// ⚠️ 既存 app.js の同名関数のミラー。両アプリが同じ settings_free/weekly_*
//    と weekly_champions / weekly_challenge_history を読み書きするため、
//    ドキュメント名・フィールド形状・冪等条件を変更しないこと。
// =====================================================================
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  type DocumentReference,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { getExerciseRatingSummaries } from './ratings';
import {
  getWeekBoundaries,
  buildChampionDocMeta,
  formatWeeklyPeriodLabel,
  getWeekNumberOfYear,
  isWeekdayJST,
  weekdayIndexJST,
} from './time-jst';
import {
  selectWeeklyExercises,
  selectExercisesTwoStage,
  selectWeeklyExercisesWithBarbarianSlot,
  incrementCreatorHistory,
  getExerciseCreatorId,
} from './weekly-select';
import {
  sumAdoptedScores,
  longestConsecutiveDays,
  computeStreakBonus,
} from './scoring';
import { RANKING_TIE_EPSILON } from './constants';
import { isWeeklyPausedWeekStart, WEEKLY_PAUSE_LABEL } from './raid-mode';
import {
  mondayKeyOfWeekStart,
  planWeeklyOverride,
  weeklyOverrideDocId,
} from './special-event';
import type {
  FreeExerciseMap,
  Post,
  UserData,
  WeeklyChallenge,
  WeeklyConfig,
} from './types';

const SETTINGS = 'settings_free';

/** 上書き設定ドキュメント（週ごと／旧単一の両方で同じ形）。 */
interface OverrideDoc {
  invalidated?: boolean;
  exercises?: string[];
  targetWeekStart?: Timestamp;
  label?: string;
  /** 承認された提案のID（管理画面の手動上書きでは無い） */
  proposalId?: string;
  source?: string;
}

// ---------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------
export async function getWeeklyConfig(): Promise<WeeklyConfig> {
  const defaults: WeeklyConfig = {
    weightExponent: 2,
    fairnessMode: 'two_stage',
    normalCount: 2,
    barbarianCount: 1,
    exerciseCount: 4,
    enableStreak: false,
    streakBonusPerDay: 3,
    streakBonusCap: 15,
    enablePrediction: false,
  };
  try {
    const snap = await getDoc(doc(db, SETTINGS, 'weekly_config'));
    if (snap.exists()) return { ...defaults, ...(snap.data() as object) };
  } catch (e) {
    console.warn('[週間チャレンジ] weekly_config取得失敗、デフォルト使用:', e);
  }
  return defaults;
}

// ---------------------------------------------------------------------
// 進行中の週の種目アップグレード（3→4種目）。app.js: maybeUpgradeCurrentWeekExercises
// ---------------------------------------------------------------------
async function maybeUpgradeCurrentWeekExercises(
  data: {
    exercises?: string[];
    selectionHistory?: Record<string, number>;
    creatorSelectionHistory?: Record<string, number>;
    isManualOverride?: boolean;
  },
  freeExercises: FreeExerciseMap,
): Promise<string[]> {
  // 特別イベント週・手動上書き週は「指定された種目がすべて」。
  // exerciseCount に足りなくても自動選出の種目を混ぜない
  if (data.isManualOverride) return data.exercises || [];
  const existing = Array.isArray(data.exercises) ? data.exercises : [];
  try {
    if (existing.length === 0) return existing;
    const cfg = await getWeeklyConfig();
    const target = cfg.exerciseCount || 3;
    if (existing.length >= target) return existing;

    const need = target - existing.length;
    const normalPool = Object.keys(freeExercises).filter(
      (k) =>
        freeExercises[k] &&
        !freeExercises[k].excludeFromWeekly &&
        !freeExercises[k].barbarian &&
        !existing.includes(k),
    );
    if (normalPool.length === 0) return existing;

    const weightExponent = cfg.weightExponent || 2;
    const history = data.selectionHistory || {};
    const creatorHistory = data.creatorSelectionHistory || {};
    const fairnessMode = cfg.fairnessMode || 'two_stage';

    let picks: string[];
    if (fairnessMode === 'legacy') {
      picks = selectWeeklyExercises(
        normalPool,
        history,
        need,
        weightExponent,
        {},
        {},
        freeExercises,
      );
    } else {
      const usedCreators = new Set(
        existing.map((k) => getExerciseCreatorId(freeExercises, k)),
      );
      picks = selectExercisesTwoStage(
        normalPool,
        freeExercises,
        history,
        creatorHistory,
        need,
        weightExponent,
        {},
        {},
        usedCreators,
      );
    }
    if (!picks || picks.length === 0) return existing;

    const newExercises = [...existing, ...picks];
    const newHistory = { ...history };
    picks.forEach((k) => {
      newHistory[k] = (newHistory[k] || 0) + 1;
    });
    const newCreatorHistory = incrementCreatorHistory(
      creatorHistory,
      picks,
      freeExercises,
    );

    await setDoc(
      doc(db, SETTINGS, 'weekly_challenge'),
      {
        exercises: newExercises,
        selectionHistory: newHistory,
        creatorSelectionHistory: newCreatorHistory,
        upgradedToCountAt: serverTimestamp(),
      },
      { merge: true },
    );

    data.exercises = newExercises;
    data.selectionHistory = newHistory;
    data.creatorSelectionHistory = newCreatorHistory;
    return newExercises;
  } catch (e) {
    console.warn('[週間チャレンジ] 種目数アップグレード失敗:', e);
    return existing;
  }
}

// ---------------------------------------------------------------------
// 今週の週間チャレンジ取得/更新。app.js: getOrUpdateWeeklyChallenge
// 前週確定・履歴保存・override 適用・自動選出を内包する（冪等）。
// ---------------------------------------------------------------------
export async function getOrUpdateWeeklyChallenge(
  freeExercises: FreeExerciseMap,
): Promise<WeeklyChallenge> {
  const { start: weekStart, end: weekEnd } = getWeekBoundaries();
  // 夏休み休止週。種目を選出せず、選出履歴にも手を付けない。
  const paused = isWeeklyPausedWeekStart(weekStart);
  const pausedChallenge = (
    selectionHistory: Record<string, number> = {},
    creatorSelectionHistory: Record<string, number> = {},
  ): WeeklyChallenge => ({
    weekStart,
    weekEnd,
    exercises: [],
    selectionHistory,
    creatorSelectionHistory,
    paused: true,
    pauseLabel: WEEKLY_PAUSE_LABEL,
  });

  try {
    const chalRef = doc(db, SETTINGS, 'weekly_challenge');
    const snap = await getDoc(chalRef);

    if (snap.exists()) {
      const data = snap.data() as {
        weekStart?: Timestamp;
        weekEnd?: Timestamp;
        exercises?: string[];
        selectionHistory?: Record<string, number>;
        creatorSelectionHistory?: Record<string, number>;
        isManualOverride?: boolean;
        overrideLabel?: string | null;
      };
      const savedWeekStart = data.weekStart ? data.weekStart.toDate() : null;

      if (
        savedWeekStart &&
        Math.abs(savedWeekStart.getTime() - weekStart.getTime()) < 60 * 1000
      ) {
        if (paused) {
          return pausedChallenge(
            data.selectionHistory || {},
            data.creatorSelectionHistory || {},
          );
        }
        const upgradedExercises = await maybeUpgradeCurrentWeekExercises(
          data,
          freeExercises,
        );
        return {
          weekStart,
          weekEnd,
          exercises: upgradedExercises,
          selectionHistory: data.selectionHistory || {},
          creatorSelectionHistory: data.creatorSelectionHistory || {},
          isManualOverride: data.isManualOverride || false,
          overrideLabel: data.overrideLabel || null,
        };
      }
    }

    // 新しい週: 前週を履歴保存＋チャンプ確定
    if (snap.exists()) {
      const prev = snap.data() as {
        weekStart?: Timestamp;
        weekEnd?: Timestamp;
        exercises?: string[];
      };
      const prevWeekStart = prev.weekStart ? prev.weekStart.toDate() : null;
      const prevWeekEnd = prev.weekEnd ? prev.weekEnd.toDate() : null;
      if (
        prevWeekStart &&
        prevWeekEnd &&
        prev.exercises &&
        prev.exercises.length > 0
      ) {
        await saveWeeklyChallengeHistory({
          weekStart: prevWeekStart,
          weekEnd: prevWeekEnd,
          exercises: prev.exercises,
        });
        await finalizeWeeklyChampion(
          {
            weekStart: prevWeekStart,
            weekEnd: prevWeekEnd,
            exercises: prev.exercises,
          },
          freeExercises,
        );
      }
    }

    const existingHistory =
      (snap.exists() &&
        (snap.data() as { selectionHistory?: Record<string, number> })
          .selectionHistory) ||
      {};
    const existingCreatorHistory =
      (snap.exists() &&
        (snap.data() as { creatorSelectionHistory?: Record<string, number> })
          .creatorSelectionHistory) ||
      {};

    // 休止週: 前週の確定だけ済ませ、今週は種目を選出しない。
    // 選出履歴はそのまま持ち越すので、再開週の公平性に影響しない。
    if (paused) {
      await setDoc(chalRef, {
        weekStart: Timestamp.fromDate(weekStart),
        weekEnd: Timestamp.fromDate(weekEnd),
        exercises: [],
        selectionHistory: existingHistory,
        creatorSelectionHistory: existingCreatorHistory,
        isManualOverride: false,
        overrideLabel: null,
        paused: true,
        pauseLabel: WEEKLY_PAUSE_LABEL,
        updatedAt: serverTimestamp(),
      });
      return pausedChallenge(existingHistory, existingCreatorHistory);
    }

    // 上書き設定の確認（承認された特別イベント / 管理画面の手動上書き）。
    // 対象週ごとに 1 ドキュメント（settings_free/weekly_override_<月曜キー>）
    // なので、来週ぶんを適用しても再来週ぶんの予約は消えない。
    const applyOverride = async (
      ov: OverrideDoc,
      sourceRef: DocumentReference,
    ): Promise<WeeklyChallenge> => {
      const selected = ov.exercises || [];
      const label = ov.label || '特別イベント';
      const newHistory = { ...existingHistory };
      selected.forEach((k) => {
        newHistory[k] = (newHistory[k] || 0) + 1;
      });
      const newCreatorHistory = incrementCreatorHistory(
        existingCreatorHistory,
        selected,
        freeExercises,
      );
      await setDoc(chalRef, {
        weekStart: Timestamp.fromDate(weekStart),
        weekEnd: Timestamp.fromDate(weekEnd),
        exercises: selected,
        selectionHistory: newHistory,
        creatorSelectionHistory: newCreatorHistory,
        isManualOverride: true,
        overrideLabel: label,
        // どの提案が適用されたか（管理画面の手動上書きなら空）。
        // 負けた提案の提案者に「上書きされた」と伝えるのに使う
        overrideProposalId: ov.proposalId || null,
        overrideSource: ov.source || 'admin',
        updatedAt: serverTimestamp(),
      });
      // 適用済みの印。exercises / proposalId は「どの提案が勝ったか」の
      // 判定に後から読むので merge で残す
      await setDoc(sourceRef, { invalidated: true }, { merge: true });
      return {
        weekStart,
        weekEnd,
        exercises: selected,
        selectionHistory: newHistory,
        creatorSelectionHistory: newCreatorHistory,
        isManualOverride: true,
        overrideLabel: label,
      } as WeeklyChallenge;
    };

    const weekOverrideRef = doc(
      db,
      SETTINGS,
      weeklyOverrideDocId(mondayKeyOfWeekStart(weekStart)),
    );
    // 旧形式（週で分けていなかった単一ドキュメント）。週ごとドキュメント導入前に
    // 書かれた設定が残っている場合があるので読み続ける。
    const legacyRef = doc(db, SETTINGS, 'weekly_override');
    const [weekOverrideSnap, legacySnap] = await Promise.all([
      getDoc(weekOverrideRef),
      getDoc(legacyRef),
    ]);
    const weekOverride = weekOverrideSnap.exists()
      ? (weekOverrideSnap.data() as OverrideDoc)
      : null;
    const legacy = legacySnap.exists()
      ? (legacySnap.data() as OverrideDoc)
      : null;

    // 判断は純粋関数へ（Timestamp → Date に直して渡す）
    const toCandidate = (ov: OverrideDoc | null) =>
      ov
        ? {
            invalidated: ov.invalidated,
            exercises: ov.exercises,
            targetWeekStart: ov.targetWeekStart
              ? ov.targetWeekStart.toDate()
              : null,
          }
        : null;
    const plan = planWeeklyOverride({
      weekOverride: toCandidate(weekOverride),
      legacyOverride: toCandidate(legacy),
      weekStart,
    });
    if (plan.use === 'week' && weekOverride) {
      return applyOverride(weekOverride, weekOverrideRef);
    }
    if (plan.use === 'legacy' && legacy) {
      return applyOverride(legacy, legacyRef);
    }
    if (plan.cleanupLegacy) {
      await setDoc(legacyRef, { invalidated: true }, { merge: true });
    }

    // 自動選出
    const weeklyConfig = await getWeeklyConfig();
    const weightExponent = weeklyConfig.weightExponent || 2;

    const allKeys = Object.keys(freeExercises || {});
    const exerciseRatings = await getExerciseRatingSummaries(allKeys);
    const creatorUserIds = [
      ...new Set(
        allKeys.map((k) => freeExercises[k]?.createdBy).filter(Boolean),
      ),
    ] as string[];
    const creatorDataMap: Record<string, UserData> = {};
    await Promise.all(
      creatorUserIds.map(async (uid) => {
        try {
          const uDoc = await getDoc(doc(db, 'users', uid));
          if (uDoc.exists()) creatorDataMap[uid] = uDoc.data() as UserData;
        } catch {
          /* 無視 */
        }
      }),
    );

    const selected = selectWeeklyExercisesWithBarbarianSlot(
      freeExercises,
      existingHistory,
      weightExponent,
      exerciseRatings,
      creatorDataMap,
      {
        fairnessMode: weeklyConfig.fairnessMode || 'two_stage',
        creatorHistory: existingCreatorHistory,
        normalCount: weeklyConfig.normalCount || 2,
        barbarianCount: weeklyConfig.barbarianCount || 1,
        revealCount: Math.max(0, (weeklyConfig.exerciseCount || 3) - 3),
      },
    );

    const newHistory = { ...existingHistory };
    selected.forEach((k) => {
      newHistory[k] = (newHistory[k] || 0) + 1;
    });
    const newCreatorHistory = incrementCreatorHistory(
      existingCreatorHistory,
      selected,
      freeExercises,
    );

    await setDoc(chalRef, {
      weekStart: Timestamp.fromDate(weekStart),
      weekEnd: Timestamp.fromDate(weekEnd),
      exercises: selected,
      selectionHistory: newHistory,
      creatorSelectionHistory: newCreatorHistory,
      updatedAt: serverTimestamp(),
    });

    return {
      weekStart,
      weekEnd,
      exercises: selected,
      selectionHistory: newHistory,
      creatorSelectionHistory: newCreatorHistory,
    };
  } catch (error) {
    console.error('[週間チャレンジ] 取得/更新に失敗:', error);
    return {
      weekStart,
      weekEnd,
      exercises: [],
      selectionHistory: {},
      creatorSelectionHistory: {},
    };
  }
}

// ---------------------------------------------------------------------
// 履歴保存。app.js: saveWeeklyChallengeHistory
// ---------------------------------------------------------------------
export async function saveWeeklyChallengeHistory(weeklyData: {
  weekStart: Date;
  weekEnd: Date;
  exercises: string[];
}): Promise<void> {
  try {
    const { docId } = buildChampionDocMeta(weeklyData.weekStart);
    const ref = doc(db, 'weekly_challenge_history', docId);
    const existing = await getDoc(ref);
    if (existing.exists()) return;
    await setDoc(ref, {
      weekStart: Timestamp.fromDate(weeklyData.weekStart),
      weekEnd: Timestamp.fromDate(weeklyData.weekEnd),
      exercises: weeklyData.exercises,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[歴代チャンプ] 履歴保存エラー:', error);
  }
}

// ---------------------------------------------------------------------
// チャンプ確定タイミング。app.js: getChampionDecisionTimeUTC / isChampionWeekDecided
// ---------------------------------------------------------------------
export function getChampionDecisionTimeUTC(weekStart: Date): Date | null {
  if (!weekStart || !(weekStart instanceof Date)) return null;
  const { monJST } = buildChampionDocMeta(weekStart);
  return new Date(monJST.getTime() + 5 * 24 * 60 * 60 * 1000); // 土曜0:00 JST
}

export function isChampionWeekDecided(
  weekStart: Date | null,
  now: Date = new Date(),
): boolean {
  if (!weekStart) return true;
  const decisionTime = getChampionDecisionTimeUTC(weekStart);
  if (!decisionTime) return true;
  return now.getTime() >= decisionTime.getTime();
}

// ---------------------------------------------------------------------
// チャンプ Payload 構築。app.js: buildWeeklyChampionPayload
// ---------------------------------------------------------------------
export interface ChampionPayload {
  champUserId: string;
  champUserName: string;
  champTotalScore: number;
  exercises: Record<string, { name: string; value: number }>;
  exerciseTop5: Record<string, unknown>;
  championBreakdown: Record<string, unknown>;
}

export async function buildWeeklyChampionPayload(
  weeklyData: { weekStart: Date; weekEnd: Date; exercises: string[] },
  freeExercises: FreeExerciseMap,
  posts: Post[],
  usersData: Record<string, string>,
): Promise<ChampionPayload | null> {
  const { weekStart, weekEnd, exercises } = weeklyData;
  const exerciseKeys = (exercises || []).filter((k) => freeExercises[k]);
  if (exerciseKeys.length === 0) return null;

  const weeklyConfig = await getWeeklyConfig();
  const streakEnabled = !!weeklyConfig.enableStreak;

  interface Rec {
    userName: string;
    exercises: Record<string, number>;
    scores: Record<string, number>;
    totalScore: number;
    streakDays?: number;
    streakBonus?: number;
    postedDays: Set<number>;
  }
  const userRecords: Record<string, Rec> = {};

  posts.forEach((post) => {
    const ts = post.timestamp as unknown as Timestamp | undefined;
    if (!ts) return;
    const postDate = ts.toDate();
    if (postDate < weekStart || postDate >= weekEnd) return;
    if (!isWeekdayJST(postDate)) return;
    if (!exerciseKeys.includes(post.exerciseType)) return;

    const numericValue = Number(post.value) || 0;
    if (numericValue <= 0) return;
    const userId = post.userId;

    if (!userRecords[userId]) {
      userRecords[userId] = {
        userName:
          usersData[userId] ||
          (post as Post & { userEmail?: string }).userEmail ||
          'Unknown',
        exercises: {},
        scores: {},
        totalScore: 0,
        postedDays: new Set<number>(),
      };
    }
    const dIdx = weekdayIndexJST(postDate);
    if (dIdx >= 0) userRecords[userId].postedDays.add(dIdx);

    const isBarbarian = !!(
      freeExercises[post.exerciseType] &&
      freeExercises[post.exerciseType].barbarian
    );
    const cur = userRecords[userId].exercises[post.exerciseType];
    if (isBarbarian) {
      if (!cur || cur > numericValue)
        userRecords[userId].exercises[post.exerciseType] = numericValue;
    } else {
      if (!cur || cur < numericValue)
        userRecords[userId].exercises[post.exerciseType] = numericValue;
    }
  });

  const exerciseTop5: Record<string, unknown> = {};
  const exerciseRecords: Record<string, { name: string; value: number }> = {};

  exerciseKeys.forEach((exerciseKey) => {
    const isBarbarian = !!(
      freeExercises[exerciseKey] && freeExercises[exerciseKey].barbarian
    );
    const leaderboard = Object.entries(userRecords)
      .map(([userId, user]) => ({
        userId,
        userName: user.userName,
        value: Number(user.exercises[exerciseKey] || 0),
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => {
        const diff = isBarbarian ? a.value - b.value : b.value - a.value;
        if (Math.abs(diff) > RANKING_TIE_EPSILON) return diff;
        return a.userId.localeCompare(b.userId);
      });

    const bestValue = leaderboard.length > 0 ? leaderboard[0].value : 0;
    const top5: Array<Record<string, unknown>> = [];
    let previousValue: number | null = null;
    let currentRank = 0;
    leaderboard.slice(0, 5).forEach((entry, index) => {
      if (
        previousValue !== null &&
        Math.abs(entry.value - previousValue) <= RANKING_TIE_EPSILON
      ) {
        /* 同率 */
      } else {
        currentRank = index + 1;
      }
      previousValue = entry.value;
      const percent = isBarbarian
        ? bestValue > 0
          ? (bestValue / entry.value) * 100
          : 0
        : bestValue > 0
          ? (entry.value / bestValue) * 100
          : 0;
      top5.push({
        rank: currentRank,
        userId: entry.userId,
        userName: entry.userName,
        value: entry.value,
        percent,
        champion: currentRank === 1,
      });
    });

    exerciseTop5[exerciseKey] = {
      name: freeExercises[exerciseKey]?.name || exerciseKey,
      maxValue: bestValue,
      barbarian: isBarbarian || false,
      top5,
    };
    exerciseRecords[exerciseKey] = {
      name: freeExercises[exerciseKey]?.name || exerciseKey,
      value: 0,
    };
  });

  // %計算
  exerciseKeys.forEach((exerciseKey) => {
    const isBarbarian = !!(
      freeExercises[exerciseKey] && freeExercises[exerciseKey].barbarian
    );
    const bestValue =
      (exerciseTop5[exerciseKey] as { maxValue?: number })?.maxValue || 0;
    Object.values(userRecords).forEach((user) => {
      const userValue = Number(user.exercises[exerciseKey] || 0);
      let percent: number;
      if (isBarbarian) {
        percent = userValue > 0 && bestValue > 0 ? (bestValue / userValue) * 100 : 0;
      } else {
        percent = bestValue > 0 ? (userValue / bestValue) * 100 : 0;
      }
      user.scores[exerciseKey] = percent;
    });
  });

  Object.values(userRecords).forEach((user) => {
    user.streakDays = longestConsecutiveDays(user.postedDays);
    user.streakBonus = streakEnabled
      ? computeStreakBonus(user.streakDays, weeklyConfig)
      : 0;
    user.totalScore =
      sumAdoptedScores(exerciseKeys.map((k) => user.scores[k] || 0)) +
      user.streakBonus;
  });

  const candidates = Object.entries(userRecords)
    .map(([userId, user]) => ({
      userId,
      userName: user.userName,
      totalScore: user.totalScore,
      exercises: user.exercises,
      scores: user.scores,
    }))
    .sort((a, b) => {
      if (Math.abs(b.totalScore - a.totalScore) > RANKING_TIE_EPSILON)
        return b.totalScore - a.totalScore;
      return a.userId.localeCompare(b.userId);
    });

  const champion = candidates[0] || null;
  if (!champion) return null;

  exerciseKeys.forEach((exerciseKey) => {
    exerciseRecords[exerciseKey].value = Number(
      champion.exercises[exerciseKey] || 0,
    );
  });

  const championBreakdown: Record<string, unknown> = {};
  exerciseKeys.forEach((exerciseKey) => {
    const detail = (exerciseTop5[exerciseKey] as { top5?: Array<Record<string, unknown>> }) || { top5: [] };
    const inEx = (detail.top5 || []).find(
      (item) => item.userId === champion.userId,
    );
    championBreakdown[exerciseKey] = {
      value: Number(champion.exercises[exerciseKey] || 0),
      percent: Number(champion.scores[exerciseKey] || 0),
      rank: inEx ? inEx.rank : null,
    };
  });

  return {
    champUserId: champion.userId,
    champUserName: champion.userName,
    champTotalScore: champion.totalScore,
    exercises: exerciseRecords,
    exerciseTop5,
    championBreakdown,
  };
}

// ---------------------------------------------------------------------
// チャンプ確定・保存。app.js: finalizeWeeklyChampion（冪等）
// ---------------------------------------------------------------------
export async function finalizeWeeklyChampion(
  weeklyData: { weekStart: Date; weekEnd: Date; exercises: string[] },
  freeExercises: FreeExerciseMap,
  options: {
    upsertDetails?: boolean;
    posts?: Post[];
    usersData?: Record<string, string>;
    detailSource?: string;
    allowUndecided?: boolean;
  } = {},
): Promise<void> {
  try {
    const {
      upsertDetails = false,
      detailSource = 'finalizeWeeklyChampion_v2',
      allowUndecided = false,
    } = options;
    const { weekStart, weekEnd, exercises } = weeklyData;

    if (!allowUndecided && !isChampionWeekDecided(weekStart)) return;

    const { docId, year, weekNumber, monJST, friJST } =
      buildChampionDocMeta(weekStart);

    const existingDoc = await getDoc(doc(db, 'weekly_champions', docId));
    if (existingDoc.exists() && !upsertDetails) return;

    // posts/users を必要時取得
    let posts = options.posts;
    let usersData = options.usersData;
    if (!posts) {
      const psnap = await getDocs(collection(db, 'posts_free'));
      posts = psnap.docs.map((d) => ({ ...(d.data() as Post), id: d.id }));
    }
    if (!usersData) {
      const usnap = await getDocs(collection(db, 'users'));
      usersData = {};
      usnap.forEach((d) => {
        const data = d.data() as UserData;
        usersData![d.id] = data.userName || data.email || '';
      });
    }

    const payload = await buildWeeklyChampionPayload(
      { weekStart, weekEnd, exercises },
      freeExercises,
      posts,
      usersData,
    );
    if (!payload) return;

    let predictionResults: unknown = null;
    try {
      const { predictions, correctUserIds } = await computePredictionResults(
        weekStart.getTime(),
        payload.champUserId,
      );
      if (Object.keys(predictions).length > 0) {
        predictionResults = { predictions, correctUserIds };
      }
    } catch (e) {
      console.warn('[チャンプ予想] 集計スキップ:', e);
    }

    const baseData = {
      year,
      weekNumber,
      weekStart: Timestamp.fromDate(weekStart),
      weekEnd: Timestamp.fromDate(weekEnd),
      periodLabel: formatWeeklyPeriodLabel(monJST, friJST),
      champUserId: payload.champUserId,
      champUserName: payload.champUserName,
      champTotalScore: payload.champTotalScore,
      exercises: payload.exercises,
      schemaVersion: 2,
      rankingMethod: 'competition',
      scoringBase: 'exercise_top_is_100',
      exerciseTop5: payload.exerciseTop5,
      championBreakdown: payload.championBreakdown,
      predictionResults,
      detailGeneratedAt: serverTimestamp(),
      detailSource,
    };

    if (existingDoc.exists()) {
      await setDoc(
        doc(db, 'weekly_champions', docId),
        { ...baseData, updatedAt: serverTimestamp() },
        { merge: true },
      );
    } else {
      await setDoc(doc(db, 'weekly_champions', docId), {
        ...baseData,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('[歴代チャンプ] チャンプ記録エラー:', error);
  }
}

// ---------------------------------------------------------------------
// 歴代チャンプ一覧（確定週のみ）。app.js: loadChampionsHistory のデータ部
// ---------------------------------------------------------------------
export interface ChampionDoc {
  id: string;
  year: number;
  weekNumber: number;
  weekStart?: Timestamp;
  periodLabel?: string;
  champUserId: string;
  champUserName: string;
  champTotalScore: number;
  exercises: Record<string, { name: string; value: number }>;
  exerciseTop5?: Record<string, unknown>;
  championBreakdown?: Record<string, unknown>;
  predictionResults?: {
    predictions: Record<string, string>;
    correctUserIds: string[];
  } | null;
}

export async function loadChampionsHistory(): Promise<ChampionDoc[]> {
  const snap = await getDocs(
    query(collection(db, 'weekly_champions'), orderBy(documentId(), 'desc')),
  );
  const now = new Date();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<ChampionDoc, 'id'>) }))
    .filter((data) => {
      const ws = data.weekStart?.toDate?.() || null;
      return isChampionWeekDecided(ws, now);
    });
}

// ---------------------------------------------------------------------
// チャンプ予想。app.js: getWeeklyPredictionsMap / saveMyPrediction / computePredictionResults
// ---------------------------------------------------------------------
export async function getWeeklyPredictionsMap(): Promise<
  Record<string, Record<string, string>>
> {
  try {
    const snap = await getDoc(doc(db, SETTINGS, 'weekly_predictions'));
    if (snap.exists())
      return (snap.data() as { weeks?: Record<string, Record<string, string>> })
        .weeks || {};
  } catch (e) {
    console.warn('[チャンプ予想] 取得失敗:', e);
  }
  return {};
}

export async function saveMyPrediction(
  weekStartMs: number,
  predictedUid: string,
): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    await setDoc(
      doc(db, SETTINGS, 'weekly_predictions'),
      { weeks: { [weekStartMs]: { [user.uid]: predictedUid } } },
      { merge: true },
    );
    return true;
  } catch (e) {
    console.error('[チャンプ予想] 保存失敗:', e);
    return false;
  }
}

export async function computePredictionResults(
  weekStartMs: number,
  champUserId: string,
): Promise<{ predictions: Record<string, string>; correctUserIds: string[] }> {
  const weeks = await getWeeklyPredictionsMap();
  const predictions = weeks[weekStartMs] || {};
  const correctUserIds = Object.entries(predictions)
    .filter(([, predicted]) => predicted === champUserId)
    .map(([uid]) => uid);
  return { predictions, correctUserIds };
}

// ---------------------------------------------------------------------
// 過去週バックフィル。app.js: checkAndFinalizePassedWeeks（詳細補完のみ）
// ---------------------------------------------------------------------
export async function checkAndFinalizePassedWeeks(
  freeExercises: FreeExerciseMap,
): Promise<void> {
  try {
    const historySnap = await getDocs(
      query(
        collection(db, 'weekly_challenge_history'),
        orderBy(documentId(), 'asc'),
      ),
    );
    if (historySnap.empty) return;

    const champsSnap = await getDocs(collection(db, 'weekly_champions'));
    const champMap = new Map<string, Record<string, unknown>>();
    champsSnap.forEach((d) => champMap.set(d.id, d.data()));

    let posts: Post[] | null = null;
    let usersData: Record<string, string> | null = null;

    for (const historyDoc of historySnap.docs) {
      const historyData = historyDoc.data() as {
        weekStart?: Timestamp;
        weekEnd?: Timestamp;
        exercises?: string[];
      };
      const champData = champMap.get(historyDoc.id) || null;
      const weekStartDate = historyData.weekStart?.toDate?.() || null;
      if (!weekStartDate || !isChampionWeekDecided(weekStartDate)) continue;

      // 履歴の種目ズレ自己修復
      const cd = champData as {
        exercises?: Record<string, unknown>;
        schemaVersion?: number;
        exerciseTop5?: unknown;
      } | null;
      if (cd && cd.exercises && typeof cd.exercises === 'object') {
        const champKeys = Object.keys(cd.exercises);
        const histKeys = Array.isArray(historyData.exercises)
          ? historyData.exercises
          : [];
        const differs =
          champKeys.length > 0 &&
          (histKeys.length !== champKeys.length ||
            champKeys.some((k) => !histKeys.includes(k)));
        if (differs) {
          try {
            await setDoc(
              doc(db, 'weekly_challenge_history', historyDoc.id),
              {
                exercises: champKeys,
                reconciledFromChampion: true,
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );
            historyData.exercises = champKeys;
          } catch (e) {
            console.warn('[歴代チャンプ] 履歴補正失敗:', historyDoc.id, e);
          }
        }
      }

      const hasDetail = !!(cd && (cd.schemaVersion || 0) >= 2 && cd.exerciseTop5);
      if (hasDetail) continue;
      if (
        !historyData.weekStart ||
        !historyData.weekEnd ||
        !Array.isArray(historyData.exercises) ||
        historyData.exercises.length === 0
      )
        continue;

      if (!posts) {
        const psnap = await getDocs(collection(db, 'posts_free'));
        posts = psnap.docs.map((d) => ({ ...(d.data() as Post), id: d.id }));
      }
      if (!usersData) {
        const usnap = await getDocs(collection(db, 'users'));
        usersData = {};
        usnap.forEach((d) => {
          const data = d.data() as UserData;
          usersData![d.id] = data.userName || data.email || '';
        });
      }

      await finalizeWeeklyChampion(
        {
          weekStart: weekStartDate,
          weekEnd: historyData.weekEnd.toDate(),
          exercises: historyData.exercises,
        },
        freeExercises,
        {
          upsertDetails: true,
          posts,
          usersData,
          detailSource: 'backfill_v1',
        },
      );
    }
  } catch (error) {
    console.error('[歴代チャンプ] 過去週チェックエラー:', error);
  }
}

// 年内週番号の再エクスポート（呼び出し側の利便のため）
export { getWeekNumberOfYear };
