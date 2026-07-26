import { useState } from 'react';
import { FirebaseError } from 'firebase/app';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { checkUsernameExists } from '../../lib/users';
import { getAuthErrorMessage } from '../../lib/errors';
import styles from './ProfileModal.module.css';

export default function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, userData, isGuest, logout, updateUsername, changePassword } =
    useAuth();
  const [newName, setNewName] = useState('');
  const [nameMsg, setNameMsg] = useState('');
  const [nameErr, setNameErr] = useState('');
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [busy, setBusy] = useState(false);

  const errMsg = (e: unknown) =>
    e instanceof FirebaseError ? getAuthErrorMessage(e.code) : '失敗しました';

  async function handleName() {
    setNameMsg('');
    setNameErr('');
    const name = newName.trim();
    if (name.length < 2 || name.length > 20) {
      setNameErr('ユーザー名は2〜20文字で入力してください');
      return;
    }
    setBusy(true);
    try {
      if (await checkUsernameExists(name)) {
        setNameErr('このユーザー名は既に使われています');
        return;
      }
      await updateUsername(name);
      setNameMsg('ユーザー名を更新しました');
      setNewName('');
    } catch (e) {
      setNameErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function handlePassword() {
    setPwMsg('');
    setPwErr('');
    if (next.length < 6) {
      setPwErr('新しいパスワードは6文字以上で入力してください');
      return;
    }
    if (next !== confirm) {
      setPwErr('新しいパスワードが一致しません');
      return;
    }
    setBusy(true);
    try {
      await changePassword(cur, next);
      setPwMsg('パスワードを変更しました');
      setCur('');
      setNext('');
      setConfirm('');
    } catch (e) {
      setPwErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="プロフィール設定" icon="fa-user" onClose={onClose}>
      {isGuest && (
        <div className={styles.guestBox}>
          <strong>
            <i className="fa-solid fa-user-clock" /> ゲストモード
          </strong>
          <p>全員で共有のゲストアカウントでログイン中です。</p>
          <p className="dim">
            本登録はログアウト後、メールアドレスで新規登録してください。
          </p>
        </div>
      )}

      <section className={styles.section}>
        <h3>アカウント</h3>
        <p className={styles.email}>{user?.email}</p>
        <p className="dim" style={{ fontSize: 13, marginTop: 2 }}>
          現在のユーザー名: <strong>{userData?.userName || '未設定'}</strong>
        </p>
        <button
          className="btn-secondary"
          style={{ marginTop: 12 }}
          onClick={() => logout()}
        >
          <i className="fa-solid fa-right-from-bracket" /> ログアウト
        </button>
      </section>

      {!isGuest && (
        <>
          <section className={styles.section}>
            <h3>ユーザー名の変更</h3>
            <p className="dim" style={{ fontSize: 13 }}>
              他のユーザーに表示される名前です（2〜20文字）
            </p>
            <div className={styles.inlineForm}>
              <input
                className="field"
                placeholder="新しいユーザー名"
                value={newName}
                maxLength={20}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button
                className="btn-primary"
                disabled={busy}
                onClick={handleName}
              >
                更新
              </button>
            </div>
            {nameMsg && <p className={styles.ok}>{nameMsg}</p>}
            {nameErr && <p className={styles.err}>{nameErr}</p>}
          </section>

          <section className={styles.section}>
            <h3>パスワード変更</h3>
            <div className="stack" style={{ gap: 8 }}>
              <input
                className="field"
                type="password"
                placeholder="現在のパスワード"
                value={cur}
                onChange={(e) => setCur(e.target.value)}
              />
              <input
                className="field"
                type="password"
                placeholder="新しいパスワード"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <input
                className="field"
                type="password"
                placeholder="新しいパスワード（確認）"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <button
                className="btn-primary"
                disabled={busy}
                onClick={handlePassword}
              >
                パスワードを変更
              </button>
            </div>
            {pwMsg && <p className={styles.ok}>{pwMsg}</p>}
            {pwErr && <p className={styles.err}>{pwErr}</p>}
          </section>
        </>
      )}
    </Modal>
  );
}
