// =====================================================================
// 種目のアーカイブ — 純粋ロジック
//
// 種目は「削除」せず「アーカイブ」する。アーカイブした種目は通常の種目マップ
// （<settings>/exercises）から外し、別ドキュメント <settings>/exercises_archive に
// 移す。種目マップの意味（＝今使える種目）は変わらないので、週間チャレンジの抽選・
// デイリーミッション・ランキング・旧版 app.js はアーカイブ済みを「無い種目」として
// これまでの削除と同じに扱う。投稿データは消えないので、復活させれば記録も戻る。
//
// Firestore の読み書きは exercise-archive-engine.ts。フリー種目
// （settings_free）とドロップセット種目（settings_dropset）の両方で使う。
// =====================================================================

/** アーカイブ時に足す情報 */
export interface ArchiveMeta {
  /** ISO 8601 */
  archivedAt: string;
  archivedBy: string | null;
  archivedByName: string | null;
}

export type Archived<T> = T & ArchiveMeta;

/** 種目らしいもの（フリー・ドロップセット共通） */
export interface ExerciseLike {
  name: string;
  createdBy?: string;
}

export interface ArchiveActor {
  uid: string;
  name: string;
}

/** 名前が残っていない過去の種目（旧版で削除され、投稿だけ残っているもの） */
export interface OrphanExercise {
  key: string;
  postCount: number;
}

/** 復元時に入る仮の作成者名（旧版の「削除種目の復元」と同じ） */
export const RESTORED_CREATOR_NAME = '（復元）';
/** 名前の最大文字数（種目追加フォームと同じ） */
export const ORPHAN_NAME_MAX = 20;

/**
 * 種目をアーカイブした後の2つのマップを返す（元のマップは変更しない）。
 * 種目マップに無いキーはエラー。
 */
export function planArchive<T extends ExerciseLike>(
  active: Record<string, T>,
  archive: Record<string, Archived<T>>,
  key: string,
  actor: ArchiveActor | null,
  now: Date = new Date(),
): { active: Record<string, T>; archive: Record<string, Archived<T>> } {
  const ex = active[key];
  if (!ex) throw new Error('この種目は見つかりませんでした（すでにアーカイブ済みかもしれません）');
  const nextActive = { ...active };
  delete nextActive[key];
  return {
    active: nextActive,
    archive: {
      ...archive,
      [key]: {
        ...ex,
        archivedAt: now.toISOString(),
        archivedBy: actor?.uid ?? null,
        archivedByName: actor?.name ?? null,
      },
    },
  };
}

/** アーカイブの印を外した種目データ */
export function stripArchiveMeta<T>(ex: Archived<T>): T {
  const { archivedAt: _a, archivedBy: _b, archivedByName: _c, ...rest } = ex;
  return rest as T;
}

/**
 * アーカイブから種目マップへ戻した後の2つのマップを返す。
 * アーカイブに無い、または同じキーがすでに種目マップにある場合はエラー。
 */
export function planRestore<T extends ExerciseLike>(
  active: Record<string, T>,
  archive: Record<string, Archived<T>>,
  key: string,
): { active: Record<string, T>; archive: Record<string, Archived<T>> } {
  const ex = archive[key];
  if (!ex) throw new Error('アーカイブにこの種目が見つかりませんでした');
  if (active[key]) throw new Error('この種目はすでに戻されています');
  const nextArchive = { ...archive };
  delete nextArchive[key];
  return { active: { ...active, [key]: stripArchiveMeta(ex) }, archive: nextArchive };
}

/**
 * 投稿には残っているが、種目マップにもアーカイブにも無い種目キー。
 * 旧版で「削除」された種目がこれにあたる。prefix で対象の種目キーに絞る。
 */
export function findOrphanExercises(
  postCounts: Record<string, number>,
  active: Record<string, unknown>,
  archive: Record<string, unknown>,
  prefix = 'free_',
): OrphanExercise[] {
  return Object.entries(postCounts)
    .filter(([key, n]) => n > 0 && key.startsWith(prefix) && !active[key] && !archive[key])
    .map(([key, postCount]) => ({ key, postCount }))
    .sort((a, b) => b.postCount - a.postCount || a.key.localeCompare(b.key));
}

/** 名前を付けて過去の種目を復活させる時の入力チェック。問題なければ null */
export function validateOrphanName(name: string): string | null {
  const n = name.trim();
  if (!n) return '種目名を入力してください';
  if (n.length > ORPHAN_NAME_MAX) return `種目名は${ORPHAN_NAME_MAX}文字までです`;
  return null;
}

/**
 * アーカイブしてよいか。だめなら理由を返す。
 * 今週の週間チャレンジや今日のデイリーミッションで使っている種目を外すと、
 * その週・その日の集計から急に消えてしまうので止める。
 */
export function archiveBlockReason(
  key: string,
  ctx: { weeklyKeys?: string[]; dailyKey?: string | null },
): string | null {
  if (ctx.weeklyKeys?.includes(key)) {
    return '今週の週間チャレンジで使っている種目は、チャレンジが終わるまでアーカイブできません';
  }
  if (ctx.dailyKey && ctx.dailyKey === key) {
    return '今日のデイリーミッションの種目は、明日になるまでアーカイブできません';
  }
  return null;
}

/** 新しくアーカイブした順 */
export function sortArchived<T>(
  archive: Record<string, Archived<T>>,
): [string, Archived<T>][] {
  return Object.entries(archive).sort(([ka, a], [kb, b]) =>
    (b.archivedAt || '').localeCompare(a.archivedAt || '') || ka.localeCompare(kb),
  );
}

/** "2026-10-18T12:34:56Z" → "10/18"（JST） */
export function formatArchivedDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()}`;
}
