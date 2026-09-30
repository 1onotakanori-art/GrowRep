// =====================================================================
// 意見箱 — Firestore の読み書き
//
// コレクション: suggestions
// {
//   title, body,          // 入力された内容（前後の空白は除去済み）
//   userId, userName,     // 投稿者（ログイン中のユーザーから自動取得）
//   createdAt,            // serverTimestamp()（端末の時計に依存しない）
// }
// 投稿後の編集・削除はできない（firestore.rules で禁止）。
// =====================================================================
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  normalizeSuggestionInput,
  validateSuggestionInput,
  SUGGESTION_LIST_LIMIT,
  type Suggestion,
  type SuggestionInput,
} from './suggestion-box';

const COL = 'suggestions';

/**
 * suggestions は後から足したコレクションなので、firestore.rules を
 * 本番へデプロイし忘れると「ルール未定義＝全拒否」で落ちる。
 * 素の "Missing or insufficient permissions." だと原因が分からないため
 * 対処法まで書いて投げ直す。
 */
function toSuggestionError(e: unknown, fallbackMessage: string): Error {
  if (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === 'permission-denied'
  ) {
    return new Error(
      'Firestore に拒否されました。firestore.rules が本番に反映されていない可能性があります' +
        '（./scripts/deploy-firestore-rules.sh を実行してください）',
    );
  }
  return e instanceof Error ? e : new Error(fallbackMessage);
}

/** 新しい順に最大 SUGGESTION_LIST_LIMIT 件 */
export async function listSuggestions(): Promise<Suggestion[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, COL),
        orderBy('createdAt', 'desc'),
        limit(SUGGESTION_LIST_LIMIT),
      ),
    );
    return snap.docs.map((d) => {
      const data = d.data();
      const ts = data.createdAt as Timestamp | null | undefined;
      return {
        id: d.id,
        title: String(data.title ?? ''),
        body: String(data.body ?? ''),
        userId: String(data.userId ?? ''),
        userName: String(data.userName || '名無しさん'),
        createdAt: ts ? ts.toDate() : null,
      };
    });
  } catch (e) {
    console.error('[意見箱] 一覧の取得に失敗:', e);
    throw toSuggestionError(e, '意見箱の読み込みに失敗しました');
  }
}

export async function createSuggestion(
  author: { uid: string; name: string },
  input: SuggestionInput,
): Promise<void> {
  const invalid = validateSuggestionInput(input);
  if (invalid) throw new Error(invalid);
  const { title, body } = normalizeSuggestionInput(input);
  try {
    await addDoc(collection(db, COL), {
      title,
      body,
      userId: author.uid,
      userName: author.name,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('[意見箱] 投稿に失敗:', e);
    throw toSuggestionError(e, '意見の送信に失敗しました');
  }
}
