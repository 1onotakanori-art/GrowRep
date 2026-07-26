// フリー種目データアクセス（settings_free/exercises）。app.js の free 種目系を移植。
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { FreeExercise, FreeExerciseMap } from './types';

const SETTINGS = 'settings_free';
const EX_DOC = 'exercises';

/** 種目マップに既定値を補完（icon / tags / excludeFromWeekly）。app.js: loadFreeExercises */
function normalize(map: FreeExerciseMap): FreeExerciseMap {
  Object.keys(map).forEach((key) => {
    const ex = map[key];
    if (!ex.icon) ex.icon = 'fa-dumbbell';
    if (!Array.isArray(ex.tags)) ex.tags = [];
    if (ex.excludeFromWeekly === undefined) ex.excludeFromWeekly = false;
  });
  return map;
}

/** Firestore から種目マップを取得。 */
export async function loadFreeExercises(): Promise<FreeExerciseMap> {
  const snap = await getDoc(doc(db, SETTINGS, EX_DOC));
  if (!snap.exists()) return {};
  const data = snap.data() as { exercises?: FreeExerciseMap };
  return normalize(data.exercises || {});
}

/** 種目マップを丸ごと保存（app.js: saveFreeExercises と同一形状）。 */
async function saveFreeExercises(map: FreeExerciseMap): Promise<void> {
  await setDoc(doc(db, SETTINGS, EX_DOC), {
    exercises: map,
    updatedAt: serverTimestamp(),
  });
}

export interface ExerciseInput {
  name: string;
  rule: string;
  icon?: string;
  tags?: string[];
  barbarian?: boolean;
  excludeFromWeekly?: boolean;
}

/**
 * 種目を追加。最新のマップを読み直してから追記し、返す。
 * key = 'free_' + timestamp（app.js: addFreeExercise）。
 */
export async function addFreeExercise(
  input: ExerciseInput,
  creator: { uid: string; name: string },
): Promise<FreeExerciseMap> {
  const map = await loadFreeExercises();
  const key = 'free_' + Date.now();
  map[key] = {
    name: input.name,
    rule: input.rule,
    icon: input.icon || 'fa-dumbbell',
    tags: input.tags || [],
    barbarian: input.barbarian || false,
    excludeFromWeekly: input.excludeFromWeekly || false,
    createdBy: creator.uid,
    // 表示用の付随情報（型には含めないが Firestore には保存）
    ...( { createdByName: creator.name, createdAt: new Date().toISOString() } as object ),
  } as FreeExercise;
  await saveFreeExercises(map);
  return map;
}

/** 種目を編集（作成者情報は保持）。app.js: editFreeExercise */
export async function editFreeExercise(
  key: string,
  input: ExerciseInput,
): Promise<FreeExerciseMap> {
  const map = await loadFreeExercises();
  const existing = (map[key] || {}) as FreeExercise & {
    createdByName?: string;
    createdAt?: string;
  };
  map[key] = {
    name: input.name,
    rule: input.rule,
    icon: input.icon || 'fa-dumbbell',
    tags: input.tags || [],
    barbarian: input.barbarian || false,
    excludeFromWeekly: input.excludeFromWeekly || false,
    createdBy: existing.createdBy,
    ...( {
      createdByName: existing.createdByName || 'Unknown',
      createdAt: existing.createdAt || new Date().toISOString(),
    } as object ),
  } as FreeExercise;
  await saveFreeExercises(map);
  return map;
}

/** 種目を削除。app.js: deleteFreeExercise */
export async function deleteFreeExercise(key: string): Promise<FreeExerciseMap> {
  const map = await loadFreeExercises();
  delete map[key];
  await saveFreeExercises(map);
  return map;
}

/** 削除済み種目キーの復元（マップに直接追加して保存）。 */
export async function restoreExercise(
  key: string,
  input: ExerciseInput,
): Promise<FreeExerciseMap> {
  const map = await loadFreeExercises();
  map[key] = {
    name: input.name,
    rule: input.rule,
    icon: input.icon || 'fa-dumbbell',
    tags: input.tags || [],
    barbarian: input.barbarian || false,
    excludeFromWeekly: input.excludeFromWeekly || false,
  };
  await saveFreeExercises(map);
  return map;
}
