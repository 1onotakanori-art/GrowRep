// Firebase 初期化（modular SDK）
// 既存アプリ（firebase-config.js, compat SDK）と同じプロジェクトに接続する。
// 値は Vite の環境変数（VITE_FIREBASE_*）から注入する。
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.warn(
    '⚠️ Firebase 設定が未完了です。web/.env（またはVercel環境変数）に VITE_FIREBASE_* を設定してください。',
  );
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// オフライン永続化（IndexedDB キャッシュ）を初期化時に有効化。
// 再訪・通信不良時に前回データを即描画でき体感速度が向上する。
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

// ゲストログイン用の共有アカウント（既存アプリと同一の資格情報）
export const GUEST_EMAIL = import.meta.env.VITE_GUEST_EMAIL;
export const GUEST_PASSWORD = import.meta.env.VITE_GUEST_PASSWORD;
