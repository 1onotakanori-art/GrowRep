// Firebase設定テンプレート
// ====================================================================
// 使い方:
// 1. このファイルをコピーして firebase-config.js を作成してください
//    $ cp firebase-config.template.js firebase-config.js
// 2. 以下のプレースホルダーをFirebase Consoleで取得した値に置き換えてください
//    Firebase Console → プロジェクト設定 → マイアプリ → SDK の設定と構成
// 3. firebase-config.js は .gitignore に含まれているため、
//    Git にコミットされません（APIキーの漏洩を防止）
// ====================================================================

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
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
