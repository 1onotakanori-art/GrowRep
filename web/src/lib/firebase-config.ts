// Firebase の接続設定。値は Vite の環境変数（VITE_FIREBASE_*）から注入する。
// アプリ本体（lib/firebase.ts, modular SDK）と管理画面（admin/main.ts, compat SDK）で共有する。
export const firebaseConfig = {
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
