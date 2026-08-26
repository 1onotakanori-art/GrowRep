import Modal from '../../components/Modal';
import { EmptyState } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useSpecialEvent } from '../../context/SpecialEventContext';
import {
  needsResponseFrom,
  summarizeResponses,
  type SpecialEventProposal,
} from '../../lib/special-event';
import styles from './SpecialEvent.module.css';

function StatusBadge({ proposal }: { proposal: SpecialEventProposal }) {
  if (proposal.status === 'approved') {
    return <span className={styles.badgeApproved}>承認済み</span>;
  }
  if (proposal.status === 'rejected') {
    return <span className={styles.badgeRejected}>否認</span>;
  }
  const s = summarizeResponses(proposal.approverIds, proposal.responses);
  return (
    <span className={styles.badgePending}>
      承認待ち {s.approved}/{s.total}
    </span>
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
                      {user && p.responses[user.uid]?.decision === 'rejected'
                        ? 'あなた: 否認'
                        : 'あなた: 承認'}
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
            {mine.map((p) => (
              <div key={p.id} className={styles.row}>
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
            ))}
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
