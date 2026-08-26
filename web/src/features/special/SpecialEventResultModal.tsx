import { useState } from 'react';
import Modal from '../../components/Modal';
import { useToast } from '../../context/ToastContext';
import {
  listDecisions,
  type SpecialEventProposal,
} from '../../lib/special-event';
import { markProposalResultSeen } from '../../lib/special-event-engine';
import styles from './SpecialEvent.module.css';

/**
 * 提案者に結果を返すポップアップ。
 * 承認者3人ぶんの承認/否認が出揃った提案だけを、確認するまで出し続ける。
 * 否認された場合は、否認した人ごとの理由コメントをそのまま表示する。
 */
export default function SpecialEventResultModal({
  proposals,
  onClose,
  onSeen,
}: {
  proposals: SpecialEventProposal[];
  onClose: () => void;
  onSeen?: () => void;
}) {
  const { toast } = useToast();
  // 既読にすると親のリストが縮むので、開いた時点の一覧を固定する
  const [queue] = useState(proposals);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const proposal = queue[index];
  if (!proposal) return null;

  const approved = proposal.status === 'approved';
  const decisions = listDecisions(proposal);
  const rejections = decisions.filter((d) => d.decision === 'rejected');

  async function confirm() {
    setBusy(true);
    try {
      await markProposalResultSeen(proposal.id);
      onSeen?.();
    } catch {
      // 既読フラグの書き込みに失敗しても結果は読めているので、閉じて先へ進む
      // （次回起動でもう一度出るだけ）
      toast('結果の既読化に失敗しました', 'info');
    } finally {
      setBusy(false);
      if (index + 1 < queue.length) setIndex(index + 1);
      else onClose();
    }
  }

  return (
    <Modal
      title="特別イベントの結果"
      icon="fa-clipboard-check"
      onClose={onClose}
      // 結果を読まずに閉じられると否認理由が伝わらないので、
      // 「確認しました」を押すまで閉じさせない
      dismissible={false}
    >
      <div className={styles.approval}>
        {queue.length > 1 && (
          <p className={styles.progress}>
            {index + 1} / {queue.length} 件
          </p>
        )}

        <div
          className={approved ? styles.resultOk : styles.resultNg}
          role="status"
        >
          <i
            className={`fa-solid ${approved ? 'fa-circle-check' : 'fa-circle-xmark'}`}
          />
          <span className={styles.resultTitle}>
            {approved ? '承認されました' : '否認されました'}
          </span>
          <span className={styles.resultSub}>
            {approved
              ? `${proposal.periodLabel} の週間チャレンジが、あなたの提案した種目に差し替わります`
              : `${proposal.periodLabel} の提案は見送りになりました`}
          </span>
        </div>

        <div className={styles.periodCard}>
          <i className="fa-solid fa-dumbbell" />
          <div>
            <span className={styles.periodLabel}>提案した種目</span>
            <span className={styles.periodValue}>
              {proposal.exerciseNames.join('・')}
            </span>
          </div>
        </div>

        {!approved && rejections.length > 0 && (
          <>
            <div className={styles.sectionHead}>
              <span className={styles.sectionTitle}>
                <i className="fa-solid fa-comment-dots" /> 否認の理由
              </span>
              <span className={styles.counter}>{rejections.length}件</span>
            </div>
            <div className={styles.list}>
              {rejections.map((d) => (
                <div key={d.userId} className={styles.commentCard}>
                  <span className={styles.commentWho}>
                    <i className="fa-solid fa-user" /> {d.userName}
                  </span>
                  <span className={styles.commentText}>
                    {d.comment || '（理由の記載がありません）'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>
            <i className="fa-solid fa-user-check" /> 承認者の回答
          </span>
        </div>
        <div className={styles.list}>
          {decisions.map((d) => (
            <div key={d.userId} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{d.userName}</span>
              </span>
              {d.decision === 'approved' ? (
                <span className={styles.badgeApproved}>承認</span>
              ) : d.decision === 'rejected' ? (
                <span className={styles.badgeRejected}>否認</span>
              ) : (
                <span className={styles.badgePending}>未回答</span>
              )}
            </div>
          ))}
        </div>

        <button className="btn-primary" disabled={busy} onClick={confirm}>
          {busy ? (
            <i className="fa-solid fa-circle-notch spin" />
          ) : (
            <>
              <i className="fa-solid fa-check" /> 確認しました
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
