// 種目評価データアクセス（exercise_ratings + user_ratings）。app.js の評価系を移植。
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type { ExerciseRatingSummary, FreeExerciseMap } from './types';

const COL = 'exercise_ratings';

export interface UserRating {
  rating: number;
  comment?: string;
  userId?: string;
  userName?: string;
  timestamp?: unknown;
  updatedAt?: unknown;
}

export interface Review extends UserRating {
  id: string;
}

/** 単一種目の集計評価。app.js: getExerciseRatingSummary */
export async function getExerciseRatingSummary(
  exerciseKey: string,
): Promise<ExerciseRatingSummary | null> {
  const snap = await getDoc(doc(db, COL, exerciseKey));
  return snap.exists() ? (snap.data() as ExerciseRatingSummary) : null;
}

/** 複数種目の集計評価をまとめて取得。app.js: getExerciseRatingSummaries */
export async function getExerciseRatingSummaries(
  keys: string[],
): Promise<Record<string, ExerciseRatingSummary>> {
  if (!keys || keys.length === 0) return {};
  const results: Record<string, ExerciseRatingSummary> = {};
  await Promise.all(
    keys.map(async (key) => {
      const data = await getExerciseRatingSummary(key);
      if (data) results[key] = data;
    }),
  );
  return results;
}

/** 複数種目の自分の評価を一括取得。app.js: getUserExerciseRatings */
export async function getUserExerciseRatings(
  exerciseKeys: string[],
): Promise<Record<string, UserRating>> {
  const user = auth.currentUser;
  if (!user || !exerciseKeys.length) return {};
  const results: Record<string, UserRating> = {};
  await Promise.all(
    exerciseKeys.map(async (key) => {
      try {
        const snap = await getDoc(
          doc(db, COL, key, 'user_ratings', user.uid),
        );
        if (snap.exists()) results[key] = snap.data() as UserRating;
      } catch {
        /* 無視 */
      }
    }),
  );
  return results;
}

/**
 * 種目評価を送信（新規 or 更新）。バッチ＋トランザクションで
 * 個別評価・集計・avgRating を原子的に更新。app.js: submitExerciseRating
 */
export async function submitExerciseRating(
  exerciseKey: string,
  rating: number,
  comment: string,
  userName: string,
  freeExercises: FreeExerciseMap,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');
  if (rating < 1 || rating > 5) throw new Error('評価は1〜5で入力してください');

  const summaryRef = doc(db, COL, exerciseKey);
  const userRatingRef = doc(db, COL, exerciseKey, 'user_ratings', user.uid);

  const existing = await getDoc(userRatingRef);
  const prevRating = existing.exists()
    ? (existing.data() as UserRating).rating || 0
    : 0;
  const isUpdate = existing.exists();

  const batch = writeBatch(db);

  const userRatingData: Record<string, unknown> = {
    rating,
    comment: comment || '',
    updatedAt: serverTimestamp(),
  };
  if (!isUpdate) {
    userRatingData.timestamp = serverTimestamp();
    userRatingData.userId = user.uid;
    userRatingData.userName = userName || user.email || '匿名';
  }

  if (isUpdate) {
    batch.update(userRatingRef, userRatingData);
    batch.update(summaryRef, {
      ratingSum: increment(rating - prevRating),
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(userRatingRef, userRatingData);
    batch.set(
      summaryRef,
      {
        ratingCount: increment(1),
        ratingSum: increment(rating),
        exerciseKey,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  await batch.commit();

  await runTransaction(db, async (tx) => {
    const s = await tx.get(summaryRef);
    if (s.exists()) {
      const d = s.data() as ExerciseRatingSummary;
      const count = d.ratingCount || 1;
      const sum = d.ratingSum || rating;
      tx.update(summaryRef, { avgRating: sum / count });
    }
  });

  const ex = freeExercises[exerciseKey];
  if (ex && ex.createdBy) {
    recalculateCreatorStats(ex.createdBy, freeExercises).catch((e) =>
      console.warn('[評価] 作成者統計更新失敗:', e),
    );
  }
}

/** 作成者評価統計を再計算して users/{uid} に保存。app.js: recalculateCreatorStats */
export async function recalculateCreatorStats(
  creatorUserId: string,
  freeExercises: FreeExerciseMap,
): Promise<void> {
  const createdKeys = Object.entries(freeExercises)
    .filter(([, ex]) => ex.createdBy === creatorUserId)
    .map(([key]) => key);
  if (createdKeys.length === 0) return;

  const summaries = await getExerciseRatingSummaries(createdKeys);
  const ratedEntries = Object.entries(summaries).filter(
    ([, s]) => (s.ratingCount || 0) > 0,
  );

  if (ratedEntries.length === 0) {
    await updateDoc(doc(db, 'users', creatorUserId), {
      creatorAvgRating: deleteField(),
      creatorRatedExerciseCount: 0,
    }).catch(() => {});
    return;
  }

  const avgOfAvgs =
    ratedEntries.reduce((sum, [, s]) => sum + s.avgRating, 0) /
    ratedEntries.length;

  await setDoc(
    doc(db, 'users', creatorUserId),
    {
      creatorAvgRating: Math.round(avgOfAvgs * 100) / 100,
      creatorRatedExerciseCount: ratedEntries.length,
    },
    { merge: true },
  );
}

/** 自分の評価を削除し集計を更新。app.js: deleteExerciseRating */
export async function deleteExerciseRating(
  exerciseKey: string,
  freeExercises: FreeExerciseMap,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('ログインが必要です');

  const summaryRef = doc(db, COL, exerciseKey);
  const userRatingRef = doc(db, COL, exerciseKey, 'user_ratings', user.uid);

  const existing = await getDoc(userRatingRef);
  if (!existing.exists()) throw new Error('評価が存在しません');
  const prevRating = (existing.data() as UserRating).rating || 0;

  const batch = writeBatch(db);
  batch.delete(userRatingRef);
  batch.update(summaryRef, {
    ratingCount: increment(-1),
    ratingSum: increment(-prevRating),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  await runTransaction(db, async (tx) => {
    const s = await tx.get(summaryRef);
    if (s.exists()) {
      const d = s.data() as ExerciseRatingSummary;
      const count = d.ratingCount || 0;
      if (count <= 0) {
        tx.update(summaryRef, { avgRating: 0, ratingCount: 0, ratingSum: 0 });
      } else {
        tx.update(summaryRef, { avgRating: (d.ratingSum || 0) / count });
      }
    }
  });

  const ex = freeExercises[exerciseKey];
  if (ex && ex.createdBy) {
    recalculateCreatorStats(ex.createdBy, freeExercises).catch((e) =>
      console.warn('[評価] 作成者統計更新失敗:', e),
    );
  }
}

/** 指定種目の全レビュー。app.js: getExerciseReviews */
export async function getExerciseReviews(
  exerciseKey: string,
): Promise<Review[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, COL, exerciseKey, 'user_ratings'),
        orderBy('updatedAt', 'desc'),
      ),
    );
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserRating) }));
  } catch (e) {
    console.warn('[評価] レビューリスト取得失敗:', e);
    return [];
  }
}
