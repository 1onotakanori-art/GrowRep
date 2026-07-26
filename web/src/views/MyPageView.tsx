import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ViewHeader, Segmented } from '../components/ui';
import ProgressChart from '../features/progress/ProgressChart';
import styles from './MyPageView.module.css';

export default function MyPageView({
  onOpenProfile,
}: {
  onOpenProfile: () => void;
}) {
  const { user, userData, isGuest } = useAuth();
  const { theme, setTheme } = useTheme();
  const displayName = userData?.userName || (isGuest ? 'ゲスト' : 'ユーザー');

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
    </div>
  );
}
