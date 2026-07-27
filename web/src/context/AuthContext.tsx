import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword as fbUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, GUEST_EMAIL, GUEST_PASSWORD } from '../lib/firebase';
import {
  createUserData,
  getUserData,
  invalidateUsersMapCache,
  touchUserActivity,
  updateUserName as fbUpdateUserName,
} from '../lib/users';
import { getDailyDateKeyJST } from '../lib/daily-mission';
import type { UserData } from '../lib/types';

interface AuthCtx {
  user: User | null;
  userData: UserData | null;
  isGuest: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  guestLogin: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUsername: (newName: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const isGuestAccount = u.email === GUEST_EMAIL;
        if (isGuestAccount) {
          let guestData = await getUserData(u.uid);
          if (!guestData) {
            await setDoc(doc(db, 'users', u.uid), {
              userId: u.uid,
              userName: 'ゲスト',
              email: GUEST_EMAIL,
              isGuest: true,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            invalidateUsersMapCache();
            guestData = await getUserData(u.uid);
          } else if (!guestData.isGuest) {
            await updateDoc(doc(db, 'users', u.uid), { isGuest: true });
            invalidateUsersMapCache();
            guestData = { ...guestData, isGuest: true };
          }
          setUserData(guestData);
        } else {
          let data = await getUserData(u.uid);
          if (!data) {
            await createUserData(u.uid, u.email || '', u.email || '');
            data = await getUserData(u.uid);
          }
          setUserData(data);
        }
        // デイリーミッションの「みんなの目標」に載る条件なので、
        // 一覧を読む DataProvider より先に今日の印を残す
        await touchUserActivity(u.uid, getDailyDateKeyJST());
        setUser(u);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!auth.currentUser) return;
    invalidateUsersMapCache();
    const data = await getUserData(auth.currentUser.uid);
    setUserData(data);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    );
    // 表示名の初期値はメールのローカル部
    const defaultName = (email.split('@')[0] || 'user').slice(0, 20);
    await createUserData(cred.user.uid, defaultName, email.trim());
  }, []);

  const guestLogin = useCallback(async () => {
    if (!GUEST_EMAIL || !GUEST_PASSWORD) {
      throw new Error('ゲスト資格情報が未設定です');
    }
    await signInWithEmailAndPassword(auth, GUEST_EMAIL, GUEST_PASSWORD);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const updateUsername = useCallback(async (newName: string) => {
    if (!auth.currentUser) throw new Error('未ログイン');
    await fbUpdateUserName(auth.currentUser.uid, newName);
    const data = await getUserData(auth.currentUser.uid);
    setUserData(data);
  }, []);

  const changePassword = useCallback(async (current: string, next: string) => {
    const u = auth.currentUser;
    if (!u || !u.email) throw new Error('未ログイン');
    const cred = EmailAuthProvider.credential(u.email, current);
    await reauthenticateWithCredential(u, cred);
    await fbUpdatePassword(u, next);
  }, []);

  const value: AuthCtx = {
    user,
    userData,
    isGuest: user?.email === GUEST_EMAIL,
    loading,
    login,
    signup,
    guestLogin,
    logout,
    resetPassword,
    updateUsername,
    changePassword,
    refreshUserData,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
