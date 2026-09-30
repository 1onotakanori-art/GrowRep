// =====================================================================
// 意見箱 — 純粋ロジック（入力チェック・表示用の整形）
//
// Firestore への読み書きは suggestion-box-engine.ts。ここは firebase を
// import しないので、Vitest からそのまま検証できる。
//
// コレクション: suggestions（1投稿 = 1ドキュメント）
// ログインユーザー全員が一覧を読める。投稿できるのは本登録ユーザーだけで、
// ゲスト（共有アカウント）は投稿できない。
// =====================================================================

/** タイトルの最大文字数 */
export const SUGGESTION_TITLE_MAX = 50;
/** 本文の最大文字数 */
export const SUGGESTION_BODY_MAX = 1000;
/** 一覧に出す最大件数（新しい順） */
export const SUGGESTION_LIST_LIMIT = 100;

export interface Suggestion {
  id: string;
  title: string;
  body: string;
  userId: string;
  userName: string;
  /** サーバー時刻。書き込み直後のローカルスナップショットでは null */
  createdAt: Date | null;
}

export interface SuggestionInput {
  title: string;
  body: string;
}

/**
 * 前後の空白を落とす。本文の途中の改行はそのまま残す
 * （段落を分けて書けるように）。
 */
export function normalizeSuggestionInput(
  input: SuggestionInput,
): SuggestionInput {
  return { title: input.title.trim(), body: input.body.trim() };
}

/**
 * 入力の問題点を返す。問題がなければ null。
 * 空白だけの入力は空とみなす（normalize 後の長さで判定する）。
 */
export function validateSuggestionInput(input: SuggestionInput): string | null {
  const { title, body } = normalizeSuggestionInput(input);
  if (!title) return 'タイトルを入力してください';
  if (title.length > SUGGESTION_TITLE_MAX) {
    return `タイトルは${SUGGESTION_TITLE_MAX}文字以内で入力してください`;
  }
  if (!body) return '本文を入力してください';
  if (body.length > SUGGESTION_BODY_MAX) {
    return `本文は${SUGGESTION_BODY_MAX}文字以内で入力してください`;
  }
  return null;
}

/**
 * 投稿日時の表示（JST 固定: 2026/9/30 14:05）。
 * toLocaleString は端末のタイムゾーン・ロケールで見た目が変わるので使わない。
 */
export function formatSuggestionDate(date: Date | null): string {
  if (!date) return '送信中…';
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  const hh = String(jst.getUTCHours()).padStart(2, '0');
  const mm = String(jst.getUTCMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}`;
}
