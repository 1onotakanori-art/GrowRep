// 月間ダービー集計。app.js: getMonthlyDerbyBounds / getCurrentDerbyYearMonth / computeMonthlyDerbyData のミラー。
import {
  collection,
  documentId,
  getDocs,
  orderBy,
  query,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { buildChampionDocMeta, isWeekdayJST } from './time-jst';
import { isChampionWeekDecided } from './weekly-engine';
import type { FreeExerciseMap, Post, UserData, WeeklyChallenge } from './types';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getMonthlyDerbyBounds(
  year: number,
  month: number,
): { derbyStart: Date; derbyEnd: Date } {
  function firstMondayUTC(y: number, m: number): Date {
    const d = new Date(Date.UTC(y, m - 1, 1));
    const dow = d.getUTCDay();
    const daysToMon = (8 - dow) % 7;
    return new Date(d.getTime() + daysToMon * 86400000);
  }
  const derbyStart = firstMondayUTC(year, month);
  let ny = year;
  let nm = month + 1;
  if (nm > 12) {
    nm = 1;
    ny++;
  }
  const nextDerbyStart = firstMondayUTC(ny, nm);
  const derbyEnd = new Date(nextDerbyStart.getTime() - 86400000);
  return { derbyStart, derbyEnd };
}

export function getCurrentDerbyYearMonth(now: Date = new Date()): {
  year: number;
  month: number;
} {
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  let year = jstNow.getUTCFullYear();
  let month = jstNow.getUTCMonth() + 1;
  const { derbyStart } = getMonthlyDerbyBounds(year, month);
  const todayUTC = new Date(
    Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()),
  );
  if (todayUTC < derbyStart) {
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
  }
  return { year, month };
}

export interface DerbyUserWeek {
  userId: string;
  userName: string;
  exercises: Record<string, number>;
  scores: Record<string, number>;
  totalScore: number;
  rank?: number;
}
export interface DerbyWeekResult {
  docId: string;
  weekNum: number;
  weekLabel: string;
  exerciseKeys: string[];
  exerciseNames: Record<string, string>;
  exerciseIsBarbarian: Record<string, boolean>;
  scores: Record<string, DerbyUserWeek>;
  rankList: DerbyUserWeek[];
}
export interface DerbyUserSummary {
  userId: string;
  userName: string;
  total: number;
  weeklyScores: number[];
}
export interface DerbyData {
  weeks: DerbyWeekResult[];
  userSummary: Record<string, DerbyUserSummary>;
  derbyStart: Date;
  derbyEnd: Date;
  year: number;
  month: number;
  isDerbyComplete: boolean;
  monthlyChamp: DerbyUserSummary | null;
}

const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
const fmtD = (d: Date) =>
  `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${dayNames[d.getUTCDay()]})`;

export async function computeMonthlyDerbyData(
  year: number,
  month: number,
  freeExercises: FreeExerciseMap,
  weeklyChallenge: WeeklyChallenge | null,
): Promise<DerbyData> {
  const { derbyStart, derbyEnd } = getMonthlyDerbyBounds(year, month);

  const [postsSnap, usersSnap, historySnap, champsSnap] = await Promise.all([
    getDocs(collection(db, 'posts_free')),
    getDocs(collection(db, 'users')),
    getDocs(
      query(
        collection(db, 'weekly_challenge_history'),
        orderBy(documentId(), 'asc'),
      ),
    ),
    getDocs(collection(db, 'weekly_champions')),
  ]);

  const usersData: Record<string, string> = {};
  usersSnap.forEach((d) => {
    const data = d.data() as UserData;
    usersData[d.id] = data.userName || data.email || 'Unknown';
  });

  const champExByDoc: Record<string, string[]> = {};
  champsSnap.forEach((d) => {
    const data = d.data() as { exercises?: Record<string, unknown> };
    if (data && data.exercises && typeof data.exercises === 'object') {
      const keys = Object.keys(data.exercises);
      if (keys.length > 0) champExByDoc[d.id] = keys;
    }
  });

  const posts: Post[] = postsSnap.docs.map((d) => ({
    ...(d.data() as Post),
    id: d.id,
  }));

  interface DerbyWeek {
    docId: string;
    weekStart: Date;
    weekEnd: Date;
    exercises: string[];
    monJST: Date;
  }
  const derbyWeeks: DerbyWeek[] = [];

  historySnap.forEach((docSnap) => {
    const data = docSnap.data() as {
      weekStart?: Timestamp;
      weekEnd?: Timestamp;
      exercises?: string[];
    };
    if (!data.weekStart || !data.exercises) return;
    const weekStart = data.weekStart.toDate();
    const weekEnd = data.weekEnd
      ? data.weekEnd.toDate()
      : new Date(weekStart.getTime() + 7 * 86400000);
    const { monJST } = buildChampionDocMeta(weekStart);
    const monDay = new Date(
      Date.UTC(monJST.getUTCFullYear(), monJST.getUTCMonth(), monJST.getUTCDate()),
    );
    if (monDay >= derbyStart && monDay <= derbyEnd) {
      const exercises =
        champExByDoc[docSnap.id] ||
        (Array.isArray(data.exercises) ? data.exercises : []);
      derbyWeeks.push({ docId: docSnap.id, weekStart, weekEnd, exercises, monJST });
    }
  });

  // 今週が期間内なら追加（history 未登録の場合）
  if (weeklyChallenge && weeklyChallenge.weekStart) {
    const { monJST, docId: currentDocId } = buildChampionDocMeta(
      weeklyChallenge.weekStart,
    );
    const monDay = new Date(
      Date.UTC(monJST.getUTCFullYear(), monJST.getUTCMonth(), monJST.getUTCDate()),
    );
    if (
      monDay >= derbyStart &&
      monDay <= derbyEnd &&
      !derbyWeeks.find((w) => w.docId === currentDocId)
    ) {
      derbyWeeks.push({
        docId: currentDocId,
        weekStart: weeklyChallenge.weekStart,
        weekEnd: weeklyChallenge.weekEnd,
        exercises: weeklyChallenge.exercises || [],
        monJST,
      });
    }
  }

  derbyWeeks.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

  const weeklyResults: DerbyWeekResult[] = [];

  derbyWeeks.forEach((week, i) => {
    const { weekStart, weekEnd, exercises, monJST } = week;
    const exerciseKeys = exercises.filter((k) => freeExercises[k]);
    const userRecords: Record<string, DerbyUserWeek> = {};

    posts.forEach((post) => {
      const ts = post.timestamp as Timestamp | null;
      if (!ts) return;
      const postDate = ts.toDate();
      if (postDate < weekStart || postDate >= weekEnd) return;
      if (!isWeekdayJST(postDate)) return;
      if (!exerciseKeys.includes(post.exerciseType)) return;
      const numVal = Number(post.value) || 0;
      if (numVal <= 0) return;
      const userId = post.userId;
      if (!userRecords[userId]) {
        userRecords[userId] = {
          userId,
          userName:
            usersData[userId] ||
            (post as Post & { userEmail?: string }).userEmail ||
            'Unknown',
          exercises: {},
          scores: {},
          totalScore: 0,
        };
      }
      const isBarbarian = !!(
        freeExercises[post.exerciseType] &&
        freeExercises[post.exerciseType].barbarian
      );
      const cur = userRecords[userId].exercises[post.exerciseType];
      if (isBarbarian) {
        if (cur === undefined || cur > numVal)
          userRecords[userId].exercises[post.exerciseType] = numVal;
      } else {
        if (cur === undefined || cur < numVal)
          userRecords[userId].exercises[post.exerciseType] = numVal;
      }
    });

    exerciseKeys.forEach((exKey) => {
      const isBarbarian = !!(
        freeExercises[exKey] && freeExercises[exKey].barbarian
      );
      if (isBarbarian) {
        let minVal = Infinity;
        Object.values(userRecords).forEach((u) => {
          const v = u.exercises[exKey];
          if (v !== undefined && v > 0 && v < minVal) minVal = v;
        });
        Object.values(userRecords).forEach((u) => {
          const v = u.exercises[exKey];
          const pct =
            v !== undefined && v > 0 && minVal !== Infinity
              ? (minVal / v) * 100
              : 0;
          u.scores[exKey] = pct;
          u.totalScore += pct;
        });
      } else {
        let maxVal = 0;
        Object.values(userRecords).forEach((u) => {
          const v = u.exercises[exKey] || 0;
          if (v > maxVal) maxVal = v;
        });
        Object.values(userRecords).forEach((u) => {
          const v = u.exercises[exKey] || 0;
          const pct = maxVal > 0 ? (v / maxVal) * 100 : 0;
          u.scores[exKey] = pct;
          u.totalScore += pct;
        });
      }
    });

    const rankList = Object.values(userRecords).sort((a, b) => {
      if (Math.abs(b.totalScore - a.totalScore) > 0.001)
        return b.totalScore - a.totalScore;
      return a.userId.localeCompare(b.userId);
    });
    let prevScore: number | null = null;
    let prevRank = 0;
    rankList.forEach((user, idx) => {
      if (prevScore !== null && Math.abs(user.totalScore - prevScore) <= 0.001) {
        user.rank = prevRank;
      } else {
        user.rank = idx + 1;
        prevRank = idx + 1;
      }
      prevScore = user.totalScore;
    });

    const friJST = new Date(monJST.getTime() + 4 * 86400000);
    weeklyResults.push({
      docId: week.docId,
      weekNum: i + 1,
      weekLabel: `第${i + 1}週 (${fmtD(monJST)}〜${fmtD(friJST)})`,
      exerciseKeys,
      exerciseNames: Object.fromEntries(
        exerciseKeys.map((k) => [k, freeExercises[k]?.name || k]),
      ),
      exerciseIsBarbarian: Object.fromEntries(
        exerciseKeys.map((k) => [k, !!freeExercises[k]?.barbarian]),
      ),
      scores: userRecords,
      rankList,
    });
  });

  const userSummary: Record<string, DerbyUserSummary> = {};
  weeklyResults.forEach((week, wi) => {
    Object.entries(week.scores).forEach(([uid, user]) => {
      if (!userSummary[uid]) {
        userSummary[uid] = {
          userId: uid,
          userName: user.userName,
          total: 0,
          weeklyScores: new Array(weeklyResults.length).fill(0),
        };
      }
      userSummary[uid].weeklyScores[wi] = user.totalScore;
      userSummary[uid].total += user.totalScore;
    });
  });

  let isDerbyComplete = false;
  let monthlyChamp: DerbyUserSummary | null = null;
  if (derbyWeeks.length > 0) {
    const lastWeek = derbyWeeks[derbyWeeks.length - 1];
    isDerbyComplete = isChampionWeekDecided(lastWeek.weekStart);
  }
  if (isDerbyComplete && Object.keys(userSummary).length > 0) {
    const cands = Object.values(userSummary).sort((a, b) => {
      if (Math.abs(b.total - a.total) > 0.001) return b.total - a.total;
      return a.userId.localeCompare(b.userId);
    });
    monthlyChamp = cands[0];
  }

  return {
    weeks: weeklyResults,
    userSummary,
    derbyStart,
    derbyEnd,
    year,
    month,
    isDerbyComplete,
    monthlyChamp,
  };
}
