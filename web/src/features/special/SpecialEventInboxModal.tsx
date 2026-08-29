import { useState } from 'react';
import Modal from '../../components/Modal';
import { EmptyState } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useSpecialEvent } from '../../context/SpecialEventContext';
import { useToast } from '../../context/ToastContext';
import {
  canWithdrawProposal,
  listRejections,
  needsResponseFrom,
  resolveDisplayStatus,
  summarizeResponses,
  type SpecialEventProposal,
} from '../../lib/special-event';
import { withdrawProposal } from '../../lib/special-event-engine';
import styles from './SpecialEvent.module.css';

function StatusBadge({ proposal }: { proposal: SpecialEventProposal }) {
  const status = resolveDisplayStatus(proposal);
  if (status === 'approved') {
    return <span className={styles.badgeApproved}>承認済み</span>;
  }
  if (status === 'rejected') {
    return <span className={styles.badgeRejected}>否認</span>;
  }
  if (status === 'withdrawn') {
    return <span className={styles.badgeWithdrawn}>取り下げ済み</span>;
  }
  if (status === 'expired') {
    // 回答が揃わないまま対象週が始まった提案。もう反映されない
    return <span className={styles.badgeWithdrawn}>期限切れ</span>;
  }
  // 3人ぶん揃って初めて結果が決まるので、進捗は「回答した人数」で出す
  const s = summarizeResponses(proposal.approverIds, proposal.responses);
  return (
    <span className={styles.badgePending}>
      回答待ち {s.approved + s.rejected}/{s.total}
    </span>
  );
}

/**
 * 「回答済みの依頼」に出す自分の回答。回答しないまま提案が確定・取り下げに
 * なることがあるので、答えていない場合は「未回答」と出す（app.js と同じ）。
 */
function describeMyDecision(
  proposal: SpecialEventProposal,
  userId: string | undefined,
): string {
  const res = userId ? proposal.responses[userId] : undefined;
  if (!res?.decision) return '未回答';
  if (res.decision === 'rejected') {
    return `あなた: 否認（${res.comment || '理由なし'}）`;
  }
  return 'あなた: 承認';
}

/**
 * 回答待ちの提案を取り下げるボタン。
 * 押し間違いで消えないよう、確認を挟んでから実際に書き込む。
 */
function WithdrawButton({ proposal }: { proposal: SpecialEventProposal }) {
  const { user } = useAuth();
  const { reload } = useSpecialEvent();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!user) return;
    setBusy(true);
    try {
      await withdrawProposal(proposal.id, user.uid);
      toast(`${proposal.periodLabel} の提案を取り下げました`, 'success');
      setConfirming(false);
      // 取り下げ済みになれば行ごと消えるが、再読み込みに失敗して
      // 残った場合にボタンが固まらないよう busy は必ず戻す
      await reload();
      setBusy(false);
    } catch (e) {
      // 取り下げと同時に回答が揃った場合はここに来る。理由をそのまま見せる
      toast(
        e instanceof Error ? e.message : '提案の取り下げに失敗しました',
        'error',
      );
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className={styles.withdrawBtn}
        onClick={() => setConfirming(true)}
      >
        <i className="fa-solid fa-rotate-left" /> 取り下げる
      </button>
    );
  }

  return (
    <div className={styles.withdrawConfirm}>
      <span className={styles.withdrawAsk}>
        この提案を取り下げますか？（承認者への依頼も取り消されます）
      </span>
      <div className={styles.withdrawActions}>
        <button
          type="button"
          className={styles.withdrawYes}
          disabled={busy}
          onClick={run}
        >
          {busy ? (
            <i className="fa-solid fa-circle-notch spin" />
          ) : (
            <>
              <i className="fa-solid fa-check" /> 取り下げる
            </>
          )}
        </button>
        <button
          type="button"
          className={styles.withdrawNo}
          disabled={busy}
          onClick={() => setConfirming(false)}
        >
          やめる
        </button>
      </div>
    </div>
  );
}

/**
 * 自分あての承認依頼と、自分が出した提案の一覧。
 * 未回答の依頼はここからも承認画面を開ける。
 */
export default function SpecialEventInboxModal({
  onClose,
  onOpenApproval,
}: {
  onClose: () => void;
  onOpenApproval: (proposals: SpecialEventProposal[]) => void;
}) {
  const { user } = useAuth();
  const { inbox, mine, loading } = useSpecialEvent();

  const pending = user
    ? inbox.filter((p) => needsResponseFrom(p, user.uid))
    : [];
  const answered = inbox.filter((p) => !pending.includes(p));

  return (
    <Modal title="イベント承認" icon="fa-user-check" onClose={onClose}>
      <div className={styles.form}>
        {loading && <p className={styles.muted}>読み込み中...</p>}

        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>
            <i className="fa-solid fa-bell" /> 未回答の依頼
          </span>
          {pending.length > 0 && (
            <span className={styles.counter}>{pending.length}件</span>
          )}
        </div>
        {pending.length === 0 ? (
          <p className={styles.muted}>承認待ちの依頼はありません</p>
        ) : (
          <>
            <div className={styles.list}>
              {pending.map((p) => (
                <div key={p.id} className={styles.row}>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>{p.periodLabel}</span>
                    <span className={styles.rowSub}>
                      {p.proposerName} さんの提案 /{' '}
                      {p.exerciseNames.join('・')}
                    </span>
                  </span>
                  <StatusBadge proposal={p} />
                </div>
              ))}
            </div>
            <button
              className="btn-primary"
              onClick={() => onOpenApproval(pending)}
            >
              <i className="fa-solid fa-check-double" /> 内容を確認して回答する
            </button>
          </>
        )}

        {answered.length > 0 && (
          <>
            <div className={styles.sectionHead}>
              <span className={styles.sectionTitle}>
                <i className="fa-solid fa-clock-rotate-left" /> 回答済みの依頼
              </span>
            </div>
            <div className={styles.list}>
              {answered.map((p) => (
                <div key={p.id} className={styles.row}>
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>{p.periodLabel}</span>
                    <span className={styles.rowSub}>
                      {p.proposerName} さんの提案 /{' '}
                      {describeMyDecision(p, user?.uid)}
                    </span>
                  </span>
                  <StatusBadge proposal={p} />
                </div>
              ))}
            </div>
          </>
        )}

        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>
            <i className="fa-solid fa-paper-plane" /> 自分の提案
          </span>
        </div>
        {mine.length === 0 ? (
          <p className={styles.muted}>まだ提案していません</p>
        ) : (
          <div className={styles.list}>
            {mine.map((p) => {
              // 否認された提案は、結果ポップアップを閉じたあとでも
              // ここから理由を読み返せるようにする
              const rejections =
                p.status === 'rejected' ? listRejections(p) : [];
              return (
                <div key={p.id}>
                  <div className={styles.row}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{p.periodLabel}</span>
                      <span className={styles.rowSub}>
                        承認者:{' '}
                        {p.approverIds
                          .map((uid) => p.approverNames[uid] || '名無しさん')
                          .join('・')}
                      </span>
                    </span>
                    <StatusBadge proposal={p} />
                  </div>
                  {user && canWithdrawProposal(p, user.uid) && (
                    <WithdrawButton proposal={p} />
                  )}
                  {rejections.map((d) => (
                    <div key={d.userId} className={styles.commentCard}>
                      <span className={styles.commentWho}>
                        <i className="fa-solid fa-comment-dots" /> {d.userName}
                        の否認理由
                      </span>
                      <span className={styles.commentText}>
                        {d.comment || '（理由の記載がありません）'}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {!loading && inbox.length === 0 && mine.length === 0 && (
          <EmptyState
            icon="fa-wand-magic-sparkles"
            message="特別イベントの提案はまだありません"
          />
        )}
      </div>
    </Modal>
  );
}
