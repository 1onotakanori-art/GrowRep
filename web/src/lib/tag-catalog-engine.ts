// タグ属性カタログ（settings_free/tag_catalog）の Firestore 読み書き。
// ドキュメントが無いうちは DEFAULT_TAG_CATALOG を使い、最初にタグを足した時に作られる。
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import {
  addTagsToCatalog,
  normalizeTagCatalog,
  type TagAddition,
  type TagCatalog,
} from './tag-catalog';

const ref = () => doc(db, 'settings_free', 'tag_catalog');

export async function loadTagCatalog(): Promise<TagCatalog> {
  const snap = await getDoc(ref());
  return normalizeTagCatalog(snap.exists() ? snap.data() : null);
}

/**
 * 新しいタグを属性に追加する。同時に別の人が足しても消し合わないよう、
 * トランザクションで最新を読み直してから書く。追加後のカタログを返す。
 */
export async function saveTagAdditions(additions: TagAddition[]): Promise<TagCatalog> {
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref());
    const current = normalizeTagCatalog(snap.exists() ? snap.data() : null);
    const next = addTagsToCatalog(current, additions);
    tx.set(ref(), { categories: next.categories, updatedAt: serverTimestamp() });
    return next;
  });
}
