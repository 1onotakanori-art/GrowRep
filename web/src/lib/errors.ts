// Firebase Auth のエラーコードを日本語メッセージに変換（既存 firebase-config.js より移植）
const errorMessages: Record<string, string> = {
  'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
  'auth/invalid-email': 'メールアドレスの形式が正しくありません',
  'auth/operation-not-allowed': 'この操作は許可されていません',
  'auth/weak-password': 'パスワードは6文字以上で設定してください',
  'auth/user-disabled': 'このアカウントは無効化されています',
  'auth/user-not-found': 'ユーザーが見つかりません',
  'auth/wrong-password': 'パスワードが間違っています',
  'auth/invalid-credential': 'メールアドレスまたはパスワードが間違っています',
  'auth/too-many-requests':
    '試行回数が多すぎます。しばらくしてからお試しください',
  'auth/network-request-failed': 'ネットワークエラーが発生しました',
};

export function getAuthErrorMessage(errorCode: string): string {
  return errorMessages[errorCode] || 'エラーが発生しました。もう一度お試しください。';
}
