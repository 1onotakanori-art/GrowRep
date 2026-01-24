// Firebase設定
// ====================================================================
// 重要: セキュリティに関する注意事項
// ====================================================================
// 1. Firebase APIキーはクライアント側での使用を前提とした公開情報です
// 2. セキュリティはFirestoreルールとAuthenticationで制御します
// 3. 本番環境では、以下の対策を推奨します：
//    - Firebase ConsoleでAPIキー制限を設定
//    - 承認済みドメインの制限
//    - Firestoreセキュリティルールの厳格化
//
// 【推奨】環境変数を使う場合（Vite使用時）：
// const firebaseConfig = {
//     apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
//     authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
//     projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
//     storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
//     messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
//     appId: import.meta.env.VITE_FIREBASE_APP_ID
// };
// ====================================================================

// TODO: Firebaseコンソールで取得した設定情報に置き換えてください
const firebaseConfig = {
  apiKey: "AIzaSyDTWKcH1DUyeHj67HsiZ5yFSOHFizZee60",
  authDomain: "growrep-65c18.firebaseapp.com",
  projectId: "growrep-65c18",
  storageBucket: "growrep-65c18.firebasestorage.app",
  messagingSenderId: "140764534093",
  appId: "1:140764534093:web:30f7500100b9d03de59304"
};


// Firebase設定の検証
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.warn('⚠️ Firebase設定が未完了です。firebase-config.jsを編集してください。');
}

// Firebase初期化
firebase.initializeApp(firebaseConfig);

// Firebase サービスの取得
const auth = firebase.auth();
const db = firebase.firestore();

// 日本語のエラーメッセージ
const errorMessages = {
    'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
    'auth/invalid-email': 'メールアドレスの形式が正しくありません',
    'auth/operation-not-allowed': 'この操作は許可されていません',
    'auth/weak-password': 'パスワードは6文字以上で設定してください',
    'auth/user-disabled': 'このアカウントは無効化されています',
    'auth/user-not-found': 'ユーザーが見つかりません',
    'auth/wrong-password': 'パスワードが間違っています',
    'auth/invalid-credential': 'メールアドレスまたはパスワードが間違っています'
};

// エラーメッセージを日本語に変換
function getErrorMessage(errorCode) {
    return errorMessages[errorCode] || 'エラーが発生しました。もう一度お試しください。';
}
