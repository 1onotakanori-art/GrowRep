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
import type { Comment, Post } from './types';

const COL = 'posts_free';

export interface LoadedPost extends Post {
  userName: string;
}

/** 新しい順に limit 件を取得し、userName を解決して返す。app.js: loadPosts */
export async function getPosts(
  limitCount: number,
): Promise<{ posts: LoadedPost[]; hasMore: boolean }> {
  const [snap, usersMap] = await Promise.all([
    getDocs(
      query(collection(db, COL), orderBy('timestamp', 'desc'), fbLimit(limitCount)),
    ),
    getUsersMap(),
  ]);
  const hasMore = snap.size >= limitCount;
  const posts: LoadedPost[] = snap.docs.map((d) => {
    const data = d.data() as Post & { userEmail?: string };
    const ud = usersMap[data.userId];
    return {
      ...data,
      id: d.id,
      userName: ud?.userName || data.userEmail || '名無しさん',
    };
  });
  return { posts, hasMore };
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
): Promise<void> {
  const ref = doc(db, COL, postId);
  await updateDoc(ref, {
    likes: currentlyLiked ? arrayRemove(uid) : arrayUnion(uid),
  });
}

/** コメント追加。app.js: addComment（timestamp は ISO 文字列） */
export async function addComment(
  postId: string,
  user: User,
  text: string,
): Promise<void> {
  await updateDoc(doc(db, COL, postId), {
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
): Promise<void> {
  const ref = doc(db, COL, postId);
  const snap = await getDoc(ref);
  const data = snap.data() as Post | undefined;
  if (!data?.comments || !data.comments[index]) return;
  const updated = [...data.comments];
  updated.splice(index, 1);
  await updateDoc(ref, { comments: updated as Comment[] });
}

/** 投稿削除。app.js: deletePost */
export async function deletePost(postId: string): Promise<void> {
  await deleteDoc(doc(db, COL, postId));
}
