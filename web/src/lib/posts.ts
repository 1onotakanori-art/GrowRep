// 投稿データアクセス（既存 app.js の posts 系関数を移植）
// free / weekly はどちらも posts_free コレクションを共用。
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromCache,
  limit as fbLimit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp,
  type Query,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';
import { getUsersMap } from './users';
import { DROPSET_POSTS } from './dropset-engine';
import type { Comment, DropsetPost, Post } from './types';

const COL = 'posts_free';

/** フィードに流れる投稿の種類。書き込み先コレクションの出し分けにも使う。 */
export type FeedKind = 'free' | 'dropset';

/**
 * フィード1件。フリー/週間（posts_free）とドロップセット（posts_dropset）の
 * 両方が流れるため、共通部分だけを必須にして、種目ごとの値は kind で分岐する。
 */
export interface LoadedPost {
  id: string;
  userId: string;
  userEmail?: string;
  exerciseType: string;
  likes?: string[];
  comments?: Comment[];
  timestamp?: Timestamp | null;
  userName: string;
  /** この投稿がどちらのコレクションのものか */
  kind: FeedKind;
  /** 回数 / 秒数 / セット数（kind === 'free' のみ） */
  value?: number;
  /** 挑戦した重量(kg)（kind === 'dropset' のみ） */
  weight?: number;
  /** 各セットでできた回数（kind === 'dropset' のみ） */
  reps?: number[];
  /** 目標回数（kind === 'dropset' のみ） */
  target?: number[];
  /** その重量をクリアしたか（kind === 'dropset' のみ） */
  cleared?: boolean;
}

/** kind から書き込み先コレクション名を得る。 */
function colOf(kind: FeedKind): string {
  return kind === 'dropset' ? DROPSET_POSTS : COL;
}

/** timestamp 未確定（serverTimestamp の反映待ち）は最新として扱う。 */
function sortKey(p: LoadedPost): number {
  return p.timestamp?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
}

/**
 * 新しい順に limit 件を取得し、userName を解決して返す。app.js: loadPosts
 * posts_free と posts_dropset の両方から取って時系列にマージする。
 */
export async function getPosts(
  limitCount: number,
): Promise<{ posts: LoadedPost[]; hasMore: boolean }> {
  const newestQuery = (name: string) =>
    getDocs(
      query(collection(db, name), orderBy('timestamp', 'desc'), fbLimit(limitCount)),
    );

  // ⚠️ posts_dropset の取得失敗でフィード全体を落とさない。
  //    Firestore ルールが未デプロイの環境では権限エラーになるが、
  //    それでフリー/週間/レイドのフィードまで止まると影響が大きい。
  const [freeSnap, dropSnap, usersMap] = await Promise.all([
    newestQuery(COL),
    newestQuery(DROPSET_POSTS).catch((e) => {
      console.warn('[フィード] ドロップセットの投稿を取得できませんでした:', e);
      return null;
    }),
    getUsersMap(),
  ]);

  const nameOf = (userId: string, email?: string) =>
    usersMap[userId]?.userName || email || '名無しさん';

  const freePosts: LoadedPost[] = freeSnap.docs.map((d) => {
    const data = d.data() as Post & { userEmail?: string };
    return {
      id: d.id,
      userId: data.userId,
      userEmail: data.userEmail,
      exerciseType: data.exerciseType,
      value: data.value,
      likes: data.likes,
      comments: data.comments,
      timestamp: data.timestamp ?? null,
      userName: nameOf(data.userId, data.userEmail),
      kind: 'free',
    };
  });

  const dropPosts: LoadedPost[] = (dropSnap?.docs ?? []).map((d) => {
    const data = d.data() as DropsetPost;
    return {
      id: d.id,
      userId: data.userId,
      userEmail: data.userEmail,
      exerciseType: data.exerciseType,
      weight: data.weight,
      reps: data.reps,
      target: data.target,
      cleared: data.cleared,
      likes: data.likes,
      comments: data.comments,
      timestamp: data.timestamp ?? null,
      userName: nameOf(data.userId, data.userEmail),
      kind: 'dropset',
    };
  });

  const merged = [...freePosts, ...dropPosts].sort(
    (a, b) => sortKey(b) - sortKey(a),
  );
  // どちらかが上限まで埋まっていれば、まだ先がある
  const hasMore =
    merged.length > limitCount ||
    freeSnap.size >= limitCount ||
    (dropSnap?.size ?? 0) >= limitCount;

  return { posts: merged.slice(0, limitCount), hasMore };
}

/** 今週分の投稿を取得（週間集計用）。timestamp で範囲絞り込み。 */
export async function getWeeklyPosts(
  weekStart: Date,
  weekEnd: Date,
): Promise<Post[]> {
  const snap = await getDocs(
    query(
      collection(db, COL),
      where('timestamp', '>=', Timestamp.fromDate(weekStart)),
      where('timestamp', '<', Timestamp.fromDate(weekEnd)),
    ),
  );
  return snap.docs.map((d) => ({ ...(d.data() as Post), id: d.id }));
}

/** since 以降の投稿だけを取る query（承認者候補などの「直近の投稿者」判定用）。 */
function postsSinceQuery(since: Date): Query {
  return query(
    collection(db, COL),
    where('timestamp', '>=', Timestamp.fromDate(since)),
  );
}

/** since 以降の投稿を取得（サーバー）。 */
export async function getPostsSince(since: Date): Promise<Post[]> {
  const snap = await getDocs(postsSinceQuery(since));
  return snap.docs.map((d) => ({ ...(d.data() as Post), id: d.id }));
}

/**
 * since 以降の投稿をローカルキャッシュ（IndexedDB）だけから取得する。
 * サーバー往復が無いので即返るが、未キャッシュなら null。
 * 「まずキャッシュを描画 → 裏でサーバー最新に差し替え」に使う。
 */
export async function getPostsSinceFromCache(
  since: Date,
): Promise<Post[] | null> {
  try {
    const snap = await getDocsFromCache(postsSinceQuery(since));
    if (snap.empty) return null;
    return snap.docs.map((d) => ({ ...(d.data() as Post), id: d.id }));
  } catch {
    return null;
  }
}

/** 全投稿を取得（フリー集計・成長グラフ用）。 */
export async function getAllPosts(): Promise<Post[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => ({ ...(d.data() as Post), id: d.id }));
}

/** 投稿を作成。app.js: submitPost */
export async function submitPost(
  user: User,
  exerciseKey: string,
  value: number,
): Promise<void> {
  await addDoc(collection(db, COL), {
    userId: user.uid,
    userEmail: user.email,
    exerciseType: exerciseKey,
    value,
    timestamp: serverTimestamp(),
    likes: [],
    comments: [],
  });
}

/** いいねのトグル。app.js: toggleLike */
export async function toggleLike(
  postId: string,
  uid: string,
  currentlyLiked: boolean,
  kind: FeedKind = 'free',
): Promise<void> {
  const ref = doc(db, colOf(kind), postId);
  await updateDoc(ref, {
    likes: currentlyLiked ? arrayRemove(uid) : arrayUnion(uid),
  });
}

/** コメント追加。app.js: addComment（timestamp は ISO 文字列） */
export async function addComment(
  postId: string,
  user: User,
  text: string,
  kind: FeedKind = 'free',
): Promise<void> {
  await updateDoc(doc(db, colOf(kind), postId), {
    comments: arrayUnion({
      userId: user.uid,
      userEmail: user.email,
      text,
      timestamp: new Date().toISOString(),
    }),
  });
}

/** コメント削除（インデックス指定）。app.js: deleteComment */
export async function deleteComment(
  postId: string,
  index: number,
  kind: FeedKind = 'free',
): Promise<void> {
  const ref = doc(db, colOf(kind), postId);
  const snap = await getDoc(ref);
  const data = snap.data() as { comments?: Comment[] } | undefined;
  if (!data?.comments || !data.comments[index]) return;
  const updated = [...data.comments];
  updated.splice(index, 1);
  await updateDoc(ref, { comments: updated as Comment[] });
}

/** 投稿削除。app.js: deletePost */
export async function deletePost(
  postId: string,
  kind: FeedKind = 'free',
): Promise<void> {
  await deleteDoc(doc(db, colOf(kind), postId));
}
