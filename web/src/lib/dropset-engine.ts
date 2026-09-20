// =====================================================================
// ドロップセットモードの Firestore アクセス
//
// 種目マスタは settings_free とは別の settings_dropset/exercises に置く。
// app.js（GitHub Pages 版）は settings_free/exercises しか読まないため、
// 週間チャレンジの抽選やデイリーミッションの選出に構造的に混ざらない。
// 詳細は dropset-mode-design.md 2. を参照。
// =====================================================================
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import {
  DEFAULT_START_WEIGHT,
  DEFAULT_STEP,
  TARGET_REPS,
  isCleared,
  type DropsetAttempt,
} from './dropset';
import type {
  DropsetExercise,
  DropsetExerciseMap,
  DropsetPost,
} from './types';

const SETTINGS = 'settings_dropset';
const EX_DOC = 'exercises';
export const DROPSET_POSTS = 'posts_dropset';

/** 種目キーの接頭辞。app.js の「削除種目の復元」が拾う `free_` と分ける。 */
const KEY_PREFIX = 'ds_';

/** 欠けている項目に既定値を補う。 */
function normalize(map: DropsetExerciseMap): DropsetExerciseMap {
  Object.keys(map).forEach((key) => {
    const ex = map[key];
    if (!ex.icon) ex.icon = 'fa-dumbbell';
    if (!Array.isArray(ex.tags)) ex.tags = [];
    if (!(Number(ex.startWeight) > 0)) ex.startWeight = DEFAULT_START_WEIGHT;
    if (!(Number(ex.step) > 0)) ex.step = DEFAULT_STEP;
  });
  return map;
}

export async function loadDropsetExercises(): Promise<DropsetExerciseMap> {
  const snap = await getDoc(doc(db, SETTINGS, EX_DOC));
  if (!snap.exists()) return {};
  const data = snap.data() as { exercises?: DropsetExerciseMap };
  return normalize(data.exercises || {});
}

async function saveDropsetExercises(map: DropsetExerciseMap): Promise<void> {
  await setDoc(doc(db, SETTINGS, EX_DOC), {
    exercises: map,
    updatedAt: serverTimestamp(),
  });
}

export interface DropsetExerciseInput {
  name: string;
  rule: string;
  icon?: string;
  tags?: string[];
  startWeight: number;
  step: number;
}

/** 種目を追加。最新のマップを読み直してから追記する（同時編集の取りこぼし防止）。 */
export async function addDropsetExercise(
  input: DropsetExerciseInput,
  creator: { uid: string; name: string },
): Promise<DropsetExerciseMap> {
  const map = await loadDropsetExercises();
  const key = KEY_PREFIX + Date.now();
  map[key] = {
    name: input.name,
    rule: input.rule,
    icon: input.icon || 'fa-dumbbell',
    tags: input.tags || [],
    startWeight: input.startWeight,
    step: input.step,
    createdBy: creator.uid,
    // 表示用の付随情報（型には含めないが Firestore には保存）
    ...({
      createdByName: creator.name,
      createdAt: new Date().toISOString(),
    } as object),
  } as DropsetExercise;
  await saveDropsetExercises(map);
  return map;
}

/** 種目を編集（作成者情報は保持）。 */
export async function editDropsetExercise(
  key: string,
  input: DropsetExerciseInput,
): Promise<DropsetExerciseMap> {
  const map = await loadDropsetExercises();
  const existing = (map[key] || {}) as DropsetExercise & {
    createdByName?: string;
    createdAt?: string;
  };
  map[key] = {
    name: input.name,
    rule: input.rule,
    icon: input.icon || 'fa-dumbbell',
    tags: input.tags || [],
    startWeight: input.startWeight,
    step: input.step,
    createdBy: existing.createdBy,
    ...({
      createdByName: existing.createdByName || 'Unknown',
      createdAt: existing.createdAt || new Date().toISOString(),
    } as object),
  } as DropsetExercise;
  await saveDropsetExercises(map);
  return map;
}

export async function deleteDropsetExercise(
  key: string,
): Promise<DropsetExerciseMap> {
  const map = await loadDropsetExercises();
  delete map[key];
  await saveDropsetExercises(map);
  return map;
}

/** 全挑戦記録を取得（6人規模なので全件で足りる）。 */
export async function getDropsetPosts(): Promise<DropsetPost[]> {
  const snap = await getDocs(collection(db, DROPSET_POSTS));
  return snap.docs.map((d) => ({ ...(d.data() as DropsetPost), id: d.id }));
}

/** Firestore の Timestamp を Date に均して、純ロジック（dropset.ts）へ渡す形にする。 */
export function toAttempts(posts: DropsetPost[]): DropsetAttempt[] {
  return posts.map((p) => ({
    userId: p.userId,
    exerciseType: p.exerciseType,
    weight: Number(p.weight),
    reps: Array.isArray(p.reps) ? p.reps.map(Number) : [],
    target: Array.isArray(p.target) ? p.target.map(Number) : undefined,
    cleared: typeof p.cleared === 'boolean' ? p.cleared : undefined,
    timestamp: (p.timestamp as Timestamp | null)?.toDate?.() ?? null,
  }));
}

/**
 * 挑戦を記録する。cleared は保存時に確定させる
 * （目標が将来変わっても、過去の判定結果が揺れないようにするため）。
 */
export async function submitDropsetAttempt(
  user: User,
  exerciseKey: string,
  weight: number,
  reps: number[],
): Promise<boolean> {
  const target = [...TARGET_REPS];
  const cleared = isCleared(reps, target);
  await addDoc(collection(db, DROPSET_POSTS), {
    userId: user.uid,
    userEmail: user.email,
    exerciseType: exerciseKey,
    weight,
    reps,
    target,
    cleared,
    timestamp: serverTimestamp(),
    likes: [],
    comments: [],
  });
  return cleared;
}
