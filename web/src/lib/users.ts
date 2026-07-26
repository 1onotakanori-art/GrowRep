// ユーザー情報アクセス（既存 app.js の users 系関数を移植）
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { CACHE_DURATION } from './constants';
import type { UserData } from './types';

let usersMapCache: Record<string, UserData> | null = null;
let usersMapCacheTime = 0;

/**
 * 全ユーザーを1回で取得しキャッシュ（N+1 削減）。
 */
export async function getUsersMap(
  forceRefresh = false,
): Promise<Record<string, UserData>> {
  const now = Date.now();
  if (
    !forceRefresh &&
    usersMapCache &&
    now - usersMapCacheTime < CACHE_DURATION
  ) {
    return usersMapCache;
  }
  const snap = await getDocs(collection(db, 'users'));
  const map: Record<string, UserData> = {};
  snap.forEach((d) => {
    map[d.id] = d.data() as UserData;
  });
  usersMapCache = map;
  usersMapCacheTime = now;
  return map;
}

export function invalidateUsersMapCache() {
  usersMapCache = null;
  usersMapCacheTime = 0;
}

export async function getUserData(userId: string): Promise<UserData | null> {
  const usersMap = await getUsersMap();
  if (usersMap[userId]) return usersMap[userId];
  const d = await getDoc(doc(db, 'users', userId));
  return d.exists() ? (d.data() as UserData) : null;
}

export async function createUserData(
  userId: string,
  userName: string,
  email: string,
): Promise<void> {
  await setDoc(doc(db, 'users', userId), {
    userId,
    userName,
    email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidateUsersMapCache();
}

export async function updateUserName(
  userId: string,
  newUserName: string,
): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    userName: newUserName,
    updatedAt: serverTimestamp(),
  });
  invalidateUsersMapCache();
}

export async function checkUsernameExists(userName: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, 'users'), where('userName', '==', userName)),
  );
  return !snap.empty;
}

/** userId → 表示名（未設定は「名無しさん」）。usersMap を使って解決。 */
export function resolveUserName(
  usersMap: Record<string, UserData>,
  userId: string,
): string {
  return usersMap[userId]?.userName || '名無しさん';
}
