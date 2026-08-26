import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSpecialEvent } from '../context/SpecialEventContext';
import { ViewHeader, Segmented } from '../components/ui';
import ProgressChart from '../features/progress/ProgressChart';
import SpecialEventProposalModal from '../features/special/SpecialEventProposalModal';
import SpecialEventApprovalModal from '../features/special/SpecialEventApprovalModal';
import SpecialEventInboxModal from '../features/special/SpecialEventInboxModal';
import type { SpecialEventProposal } from '../lib/special-event';
import styles from './MyPageView.module.css';

export default function MyPageView({
  onOpenProfile,
}: {
  onOpenProfile: () => void;
}) {
  const { user, userData, isGuest } = useAuth();
  const { theme, setTheme } = useTheme();
  const { pending, reload } = useSpecialEvent();
  const displayName = userData?.userName || (isGuest ? 'ゲスト' : 'ユーザー');

  const [proposalOpen, setProposalOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [approving, setApproving] = useState<SpecialEventProposal[] | null>(
    null,
  );

  return (
    <div className="fade-in">
      <ViewHeader icon="fa-user" title="マイページ" />

      <button className={styles.profileCard} onClick={onOpenProfile}>
        <span className={styles.avatar}>{displayName.charAt(0)}</span>
        <div className={styles.pInfo}>
          <span className={styles.pName}>{displayName}</span>
          <span className={styles.pEmail}>{user?.email}</span>
        </div>
        <i className="fa-solid fa-chevron-right" />
      </button>

      <div className={styles.eventRow}>
        <button
          className={styles.eventBtn}
          onClick={() => setProposalOpen(true)}
        >
          <i className="fa-solid fa-wand-magic-sparkles" />
          特別イベント提案
        </button>
        <button className={styles.eventBtn} onClick={() => setInboxOpen(true)}>
          <i className="fa-solid fa-user-check" />
          イベント承認
          {pending.length > 0 && (
            <span className={styles.eventBadge}>{pending.length}</span>
          )}
        </button>
      </div>

      <div className={styles.themeRow}>
        <span className={styles.themeLabel}>
          <i className="fa-solid fa-palette" /> テーマ
        </span>
        <Segmented<'light' | 'dark' | 'system'>
          options={[
            { value: 'light', label: 'ライト' },
            { value: 'dark', label: 'ダーク' },
            { value: 'system', label: '自動' },
          ]}
          value={theme}
          onChange={setTheme}
        />
      </div>

      {/* タイマーは専用タブへ移動（ボトムナビ）。ここは成長グラフのみ。 */}
      <ProgressChart />

      {proposalOpen && (
        <SpecialEventProposalModal
          onClose={() => setProposalOpen(false)}
          onSubmitted={reload}
        />
      )}
      {inboxOpen && (
        <SpecialEventInboxModal
          onClose={() => setInboxOpen(false)}
          onOpenApproval={(list) => {
            setInboxOpen(false);
            setApproving(list);
          }}
        />
      )}
      {approving && (
        <SpecialEventApprovalModal
          proposals={approving}
          onClose={() => setApproving(null)}
          onResolved={reload}
        />
      )}
    </div>
  );
}
