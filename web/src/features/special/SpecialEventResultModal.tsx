import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { useToast } from '../../context/ToastContext';
import {
  listDecisions,
  resolveDisplayStatus,
  type ApprovedOutcome,
  type SpecialEventProposal,
} from '../../lib/special-event';
import {
  loadApprovedOutcome,
  markProposalResultSeen,
} from '../../lib/special-event-engine';
import styles from './SpecialEvent.module.css';

/**
 * 提案者に結果を返すポップアップ。
 * 承認者3人ぶんの承認/否認が出揃った提案と、回答が揃わないまま対象週が
 * 始まってしまった提案（期限切れ）を、確認するまで出し続ける。
 * 否認された場合は、否認した人ごとの理由コメントをそのまま表示する。
 *
 * 承認された提案でも、同じ週に別の提案があとから承認されていたり管理者が
 * 手動設定していれば上書きされている。対象週の上書き設定を読んで、
 * 実際に自分の提案が採用されたのかまで伝える。
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
  // 承認された提案が実際に対象週へ反映されたか（別のイベントに負けていないか）
  const [outcome, setOutcome] = useState<ApprovedOutcome>({ kind: 'unknown' });

  const display = proposal ? resolveDisplayStatus(proposal) : 'pending';

  useEffect(() => {
    if (!proposal || display !== 'approved') {
      setOutcome({ kind: 'unknown' });
      return;
    }
    let alive = true;
    setOutcome({ kind: 'unknown' });
    loadApprovedOutcome(proposal).then((o) => {
      if (alive) setOutcome(o);
    });
    return () => {
      alive = false;
    };
  }, [proposal, display]);

  if (!proposal) return null;

  const approved = display === 'approved';
  const expired = display === 'expired';
  const superseded = approved && outcome.kind === 'superseded';
  // 「反映される」と言い切れるのは、承認され、かつ上書きされていない時だけ
  const good = approved && !superseded;
  const decisions = listDecisions(proposal);
  const rejections = decisions.filter((d) => d.decision === 'rejected');

  const resultTitle = expired
    ? '期限切れになりました'
    : superseded
      ? '別のイベントに差し替えられました'
      : approved
        ? '承認されました'
        : '否認されました';
  const resultSub = expired
    ? `${proposal.periodLabel} が始まるまでに承認者全員の回答が揃いませんでした`
    : superseded && outcome.kind === 'superseded'
      ? `承認はされましたが、${proposal.periodLabel} は「${outcome.byLabel}」に上書きされました（${
          outcome.byAdmin ? '管理者の手動設定' : 'あとから承認された別の提案'
        }）`
      : approved
        ? `${proposal.periodLabel} の週間チャレンジが、あなたの提案した種目に差し替わります`
        : `${proposal.periodLabel} の提案は見送りになりました`;

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

        <div className={good ? styles.resultOk : styles.resultNg} role="status">
          <i
            className={`fa-solid ${good ? 'fa-circle-check' : 'fa-circle-xmark'}`}
          />
          <span className={styles.resultTitle}>{resultTitle}</span>
          <span className={styles.resultSub}>{resultSub}</span>
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

        {rejections.length > 0 && (
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
