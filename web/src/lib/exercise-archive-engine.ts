// =====================================================================
// 種目のアーカイブ — Firestore の読み書き
//
// <settings>/exercises          { exercises: { key: 種目 }, updatedAt }   … 今使える種目
// <settings>/exercises_archive  { exercises: { key: 種目 + archivedAt/By/ByName }, updatedAt }
// <settings> は settings_free（フリー種目）か settings_dropset（ドロップセット種目）。
//
// 2つのドキュメントを必ず一緒に書き換えるため、トランザクションで
// 「読む → 移す → 両方書く」を行う（同時操作で種目が消えたり二重になったりしない）。
// firestore.rules は settings_free/{docId}・settings_dropset/{docId} で
// 認証済みユーザーの create/update を許可済み（ルールの変更は不要）。
// =====================================================================
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import {
  planArchive,
  planRestore,
  RESTORED_CREATOR_NAME,
  validateOrphanName,
  type ArchiveActor,
  type Archived,
  type ExerciseLike,
} from './exercise-archive';

export type ExerciseSettings = 'settings_free' | 'settings_dropset';

const ACTIVE_DOC = 'exercises';
const ARCHIVE_DOC = 'exercises_archive';

type Map<T> = Record<string, T>;

function mapOf<T>(data: unknown): Map<T> {
  const ex = (data as { exercises?: Map<T> } | undefined)?.exercises;
  return ex && typeof ex === 'object' ? ex : {};
}

/** アーカイブ済みの種目 */
export async function loadArchivedExercises<T extends ExerciseLike>(
  settings: ExerciseSettings,
): Promise<Map<Archived<T>>> {
  const snap = await getDoc(doc(db, settings, ARCHIVE_DOC));
  return snap.exists() ? mapOf<Archived<T>>(snap.data()) : {};
}

/**
 * 2つのドキュメントを読んで fn で書き換え、両方を保存する。
 * 保存後の種目マップを返す（画面の種目一覧の差し替え用）。
 */
async function moveBetween<T extends ExerciseLike>(
  settings: ExerciseSettings,
  fn: (
    active: Map<T>,
    archive: Map<Archived<T>>,
  ) => { active: Map<T>; archive: Map<Archived<T>> },
): Promise<Map<T>> {
  const activeRef = doc(db, settings, ACTIVE_DOC);
  const archiveRef = doc(db, settings, ARCHIVE_DOC);
  return runTransaction(db, async (tx) => {
    const [a, b] = await Promise.all([tx.get(activeRef), tx.get(archiveRef)]);
    const next = fn(mapOf<T>(a.data()), mapOf<Archived<T>>(b.data()));
    tx.set(activeRef, { exercises: next.active, updatedAt: serverTimestamp() });
    tx.set(archiveRef, { exercises: next.archive, updatedAt: serverTimestamp() });
    return next.active;
  });
}

/** 種目をアーカイブする */
export function archiveExercise<T extends ExerciseLike>(
  settings: ExerciseSettings,
  key: string,
  actor: ArchiveActor,
): Promise<Map<T>> {
  return moveBetween<T>(settings, (active, archive) =>
    planArchive(active, archive, key, actor),
  );
}

/** アーカイブから戻す */
export function restoreArchivedExercise<T extends ExerciseLike>(
  settings: ExerciseSettings,
  key: string,
): Promise<Map<T>> {
  return moveBetween<T>(settings, (active, archive) =>
    planRestore(active, archive, key),
  );
}

/**
 * 名前が残っていない過去の種目（旧版で削除済み）に名前を付けて種目マップへ戻す。
 * 旧版 app.js の「削除種目の復元」と同じ形で保存する。フリー種目のみ。
 */
export function restoreOrphanExercise(
  key: string,
  name: string,
  actor: ArchiveActor,
): Promise<Map<ExerciseLike>> {
  const err = validateOrphanName(name);
  if (err) return Promise.reject(new Error(err));
  return moveBetween<ExerciseLike>('settings_free', (active, archive) => {
    if (active[key] || archive[key]) {
      throw new Error('この種目はすでに戻されています');
    }
    return {
      active: {
        ...active,
        [key]: {
          name: name.trim(),
          rule: '',
          icon: 'fa-dumbbell',
          tags: [],
          barbarian: false,
          createdBy: actor.uid,
          createdByName: RESTORED_CREATOR_NAME,
          createdAt: new Date().toISOString(),
        } as ExerciseLike,
      },
      archive,
    };
  });
}
