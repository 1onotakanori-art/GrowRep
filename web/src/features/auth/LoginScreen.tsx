import { useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { useAuth } from '../../context/AuthContext';
import { getAuthErrorMessage } from '../../lib/errors';
import styles from './LoginScreen.module.css';

export default function LoginScreen() {
  const { login, signup, guestLogin, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetErr, setResetErr] = useState('');

  const errMsg = (e: unknown) =>
    e instanceof FirebaseError
      ? getAuthErrorMessage(e.code)
      : 'エラーが発生しました。もう一度お試しください。';

  async function run(action: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  function handleLogin() {
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }
    run(() => login(email, password));
  }

  function handleSignup() {
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上で設定してください');
      return;
    }
    run(() => signup(email, password));
  }

  async function handleReset() {
    setResetMsg('');
    setResetErr('');
    if (!resetEmail) {
      setResetErr('メールアドレスを入力してください');
      return;
    }
    try {
      await resetPassword(resetEmail);
      setResetMsg('リセットメールを送信しました。受信箱をご確認ください。');
    } catch (e) {
      setResetErr(errMsg(e));
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        <div className={styles.brand}>
          <span className={styles.logo}>
            <i className="fa-solid fa-dumbbell" />
          </span>
          <h1>GrowRep</h1>
          <p className={styles.tagline}>筋トレ成果報告アプリ in 共和</p>
        </div>

        <div className={styles.form}>
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button
            className="btn-primary"
            disabled={busy}
            onClick={handleLogin}
          >
            {busy ? <i className="fa-solid fa-circle-notch spin" /> : 'ログイン'}
          </button>
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={handleSignup}
          >
            新規登録
          </button>

          <div className={styles.divider}>
            <span>または</span>
          </div>

          <button
            className={styles.guest}
            disabled={busy}
            onClick={() => run(guestLogin)}
          >
            <i className="fa-solid fa-user-clock" /> ゲストとしてログイン
          </button>
          <p className={styles.guestNote}>記録の閲覧や体験用の共有アカウント</p>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.forgot}
            onClick={() => setResetOpen((v) => !v)}
          >
            パスワードを忘れた場合
          </button>

          {resetOpen && (
            <div className={styles.reset}>
              <input
                type="email"
                placeholder="登録メールアドレス"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
              <button className="btn-primary" onClick={handleReset}>
                リセットメールを送信
              </button>
              {resetMsg && <p className={styles.success}>{resetMsg}</p>}
              {resetErr && <p className={styles.error}>{resetErr}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
