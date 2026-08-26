import { useState } from 'react';
import Modal from '../../components/Modal';
import { Barbadge } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import {
  summarizeResponses,
  validateDecisionComment,
  SPECIAL_EVENT_COMMENT_MAX,
  type ApprovalDecision,
  type SpecialEventProposal,
} from '../../lib/special-event';
import { respondToProposal } from '../../lib/special-event-engine';
import styles from './SpecialEvent.module.css';

/**
 * 特別イベントの承認依頼ポップアップ。
 * mandatory=true（起動時の通知）では承認/否認を選ぶまで閉じられない。
 * 判断できるように、各種目の名前とルールを必ず表示する。
 *
 * 否認するときは理由コメントが必須。入力した理由は、3人の回答が
 * 揃ったあとに提案者へ結果ポップアップで返される。
 */
export default function SpecialEventApprovalModal({
  proposals,
  onClose,
  onResolved,
  mandatory = false,
}: {
  proposals: SpecialEventProposal[];
  onClose: () => void;
  onResolved?: () => void;
  mandatory?: boolean;
}) {
  const { user } = useAuth();
  const { freeExercises } = useData();
  const { toast } = useToast();
  // 回答するたびに親の pending が縮むので、開いた時点の一覧を固定して
  // 最後の1件まで順番に聞けるようにする。
  const [queue] = useState(proposals);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<ApprovalDecision | null>(null);
  const [err, setErr] = useState('');
  // 「否認する」を押すと理由の入力欄が開く（空のままでは確定できない）
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState('');

  const proposal = queue[index];
  if (!user || !proposal) return null;

  const summary = summarizeResponses(proposal.approverIds, proposal.responses);
  const commentError = validateDecisionComment('rejected', comment);

  /** 次の1件へ進む。最後まで答えたら閉じる。 */
  function advance() {
    setRejecting(false);
    setComment('');
    setErr('');
    if (index + 1 < queue.length) setIndex(index + 1);
    else onClose();
  }

  async function respond(decision: ApprovalDecision) {
    if (!user) return;
    if (decision === 'rejected' && commentError) {
      setErr(commentError);
      return;
    }
    setBusy(decision);
    setErr('');
    try {
      const status = await respondToProposal(
        proposal.id,
        user.uid,
        decision,
        decision === 'rejected' ? comment : '',
      );
      if (status === 'approved') {
        toast(
          `${proposal.periodLabel} の特別イベントが決定しました！`,
          'success',
        );
      } else if (decision === 'approved') {
        toast('承認しました', 'success');
      } else {
        toast('否認しました', 'info');
      }
      onResolved?.();
      advance();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '送信に失敗しました');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      title="特別イベントの承認"
      icon="fa-wand-magic-sparkles"
      onClose={onClose}
      dismissible={!mandatory}
    >
      <div className={styles.approval}>
        {queue.length > 1 && (
          <p className={styles.progress}>
            {index + 1} / {queue.length} 件
          </p>
        )}

        <p className={styles.lead}>
          <strong>{proposal.proposerName}</strong> さんから特別イベントウィークの
          提案が届いています。内容を確認して承認/否認を選んでください。
        </p>

        <div className={styles.periodCard}>
          <i className="fa-solid fa-calendar-day" />
          <div>
            <span className={styles.periodLabel}>対象週</span>
            <span className={styles.periodValue}>{proposal.periodLabel}</span>
          </div>
        </div>

        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>
            <i className="fa-solid fa-dumbbell" /> 種目とルール
          </span>
        </div>
        <ol className={styles.ruleList}>
          {proposal.exercises.map((key, i) => {
            const ex = freeExercises[key];
            const name = ex?.name || proposal.exerciseNames[i] || key;
            return (
              <li key={key} className={styles.ruleItem}>
                <span className={styles.ruleIcon}>
                  <i className={`fa-solid ${ex?.icon || 'fa-dumbbell'}`} />
                </span>
                <div className={styles.ruleBody}>
                  <span className={styles.ruleName}>
                    {name}
                    {ex?.barbarian && <Barbadge />}
                  </span>
                  <span className={styles.ruleText}>
                    {ex?.rule || 'ルールの記載がありません'}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        <p className={styles.approvers}>
          回答状況: 承認 {summary.approved} / 否認 {summary.rejected} / 未回答{' '}
          {summary.pending}（
          {proposal.approverIds
            .map((uid) => proposal.approverNames[uid] || '名無しさん')
            .join('・')}
          ）
        </p>

        {rejecting && (
          <div className={styles.commentBox}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionTitle}>
                <i className="fa-solid fa-comment-dots" /> 否認する理由（必須）
              </span>
              <span className={styles.counter}>
                {comment.trim().length}/{SPECIAL_EVENT_COMMENT_MAX}
              </span>
            </div>
            <textarea
              className={styles.commentInput}
              value={comment}
              maxLength={SPECIAL_EVENT_COMMENT_MAX}
              rows={3}
              autoFocus
              placeholder="例: この週は出張で参加できない人が多そうなので、別の週にしてほしいです"
              onChange={(e) => setComment(e.target.value)}
            />
            <p className={styles.muted}>
              入力した理由は、3人の回答が揃ったあとに提案者へ通知されます
            </p>
          </div>
        )}

        {err && <p className={styles.err}>{err}</p>}

        {rejecting ? (
          <div className={styles.actions}>
            <button
              className="btn-secondary"
              disabled={busy !== null}
              onClick={() => {
                setRejecting(false);
                setErr('');
              }}
            >
              <i className="fa-solid fa-arrow-left" /> やめる
            </button>
            <button
              className="btn-primary"
              disabled={busy !== null || commentError !== null}
              onClick={() => respond('rejected')}
            >
              {busy === 'rejected' ? (
                <i className="fa-solid fa-circle-notch spin" />
              ) : (
                <>
                  <i className="fa-solid fa-xmark" /> この理由で否認する
                </>
              )}
            </button>
          </div>
        ) : (
          <div className={styles.actions}>
            <button
              className="btn-secondary"
              disabled={busy !== null}
              onClick={() => {
                setErr('');
                setRejecting(true);
              }}
            >
              <i className="fa-solid fa-xmark" /> 否認する
            </button>
            <button
              className="btn-primary"
              disabled={busy !== null}
              onClick={() => respond('approved')}
            >
              {busy === 'approved' ? (
                <i className="fa-solid fa-circle-notch spin" />
              ) : (
                <>
                  <i className="fa-solid fa-check" /> 承認する
                </>
              )}
            </button>
          </div>
        )}
        {mandatory && (
          <p className={styles.hint}>
            承認か否認を選ぶまで、アプリを開くたびにこの確認が表示されます
          </p>
        )}
      </div>
    </Modal>
  );
}
