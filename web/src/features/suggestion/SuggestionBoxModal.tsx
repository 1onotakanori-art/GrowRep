import { useCallback, useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { EmptyState } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  formatSuggestionDate,
  validateSuggestionInput,
  SUGGESTION_BODY_MAX,
  SUGGESTION_TITLE_MAX,
  type Suggestion,
} from '../../lib/suggestion-box';
import {
  createSuggestion,
  listSuggestions,
} from '../../lib/suggestion-box-engine';
import styles from './SuggestionBox.module.css';

/**
 * 意見箱。上に投稿フォーム、下にみんなの投稿（新しい順）。
 * 投稿者名と投稿日時はログイン中のユーザーとサーバー時刻から自動で入る。
 * ゲスト（共有アカウント）は閲覧のみ。
 */
export default function SuggestionBoxModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const { user, userData, isGuest } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // メールアドレスは他のユーザーにも見えるので、名前の代わりには使わない
  const authorName = userData?.userName || '名無しさん';

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setItems(await listSuggestions());
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : '意見箱の読み込みに失敗しました',
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const invalid = validateSuggestionInput({ title, body });
  const canSubmit = !invalid && !busy && !isGuest && !!user;

  async function submit() {
    if (!user || isGuest) return;
    if (invalid) {
      toast(invalid, 'error');
      return;
    }
    setBusy(true);
    try {
      await createSuggestion(
        { uid: user.uid, name: authorName },
        { title, body },
      );
      toast('意見を送信しました。ありがとうございます！', 'success');
      setTitle('');
      setBody('');
      await load();
    } catch (e) {
      toast(
        e instanceof Error ? e.message : '意見の送信に失敗しました',
        'error',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="意見箱" icon="fa-envelope-open-text" onClose={onClose}>
      <div className={styles.wrap}>
        <p className={styles.lead}>
          アプリへの要望・不具合・感想などを運営に届けます。投稿はログイン中の全員が読めます。
        </p>

        {isGuest ? (
          <p className={styles.warn}>
            <i className="fa-solid fa-triangle-exclamation" />{' '}
            ゲストアカウントからは投稿できません（閲覧のみ）
          </p>
        ) : (
          <div className={styles.form}>
            <label className={styles.label} htmlFor="suggestion-title">
              タイトル
            </label>
            <input
              id="suggestion-title"
              className="field"
              type="text"
              maxLength={SUGGESTION_TITLE_MAX}
              placeholder="例: ランキングに月間表示がほしい"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className={styles.count}>
              {title.length}/{SUGGESTION_TITLE_MAX}
            </p>

            <label className={styles.label} htmlFor="suggestion-body">
              本文
            </label>
            <textarea
              id="suggestion-body"
              className="field"
              rows={5}
              maxLength={SUGGESTION_BODY_MAX}
              placeholder="内容を書いてください"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <p className={styles.count}>
              {body.length}/{SUGGESTION_BODY_MAX}
            </p>

            <p className={styles.author}>
              <i className="fa-solid fa-user" /> 投稿者: {authorName}
              （投稿日時とあわせて自動で記録されます）
            </p>

            <button
              className="btn-primary"
              disabled={!canSubmit}
              onClick={submit}
            >
              {busy ? (
                <i className="fa-solid fa-circle-notch spin" />
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane" /> 送信する
                </>
              )}
            </button>
          </div>
        )}

        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>
            <i className="fa-solid fa-inbox" /> みんなの投稿
          </span>
          {items && items.length > 0 && (
            <span className={styles.counter}>{items.length}件</span>
          )}
        </div>

        {loadError && <p className={styles.err}>{loadError}</p>}
        {!items && !loadError && <p className={styles.muted}>読み込み中...</p>}
        {items && items.length === 0 && (
          <EmptyState
            icon="fa-envelope-open-text"
            message="まだ投稿はありません"
          />
        )}
        {items && items.length > 0 && (
          <div className={styles.list}>
            {items.map((s) => (
              <article key={s.id} className={styles.card}>
                <h3 className={styles.cardTitle}>{s.title}</h3>
                <p className={styles.cardBody}>{s.body}</p>
                <p className={styles.cardMeta}>
                  {s.userName} ・ {formatSuggestionDate(s.createdAt)}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
