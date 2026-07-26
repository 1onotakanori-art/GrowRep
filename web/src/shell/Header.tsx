import { useState } from 'react';
import { useMode } from '../context/ModeContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { Mode } from '../lib/types';
import styles from './Header.module.css';

export default function Header({
  onOpenProfile,
}: {
  onOpenProfile: () => void;
}) {
  const { mode, setMode, refresh } = useMode();
  const { resolved, toggle } = useTheme();
  const { userData, isGuest } = useAuth();
  const [spinning, setSpinning] = useState(false);

  const displayName = userData?.userName || (isGuest ? 'ゲスト' : 'ユーザー');

  function handleRefresh() {
    setSpinning(true);
    refresh();
    window.setTimeout(() => setSpinning(false), 600);
  }

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.logo}>
          <i className="fa-solid fa-dumbbell" />
        </span>
        <div className={styles.modeToggle} role="tablist" aria-label="モード">
          {(['free', 'weekly'] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? styles.modeActive : styles.modeBtn}
              onClick={() => setMode(m)}
            >
              {m === 'free' ? 'フリー' : '週間'}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.right}>
        <button
          className={styles.iconBtn}
          onClick={handleRefresh}
          aria-label="更新"
        >
          <i
            className={`fa-solid fa-rotate ${spinning ? 'spin' : ''}`}
          />
        </button>
        <button
          className={styles.iconBtn}
          onClick={toggle}
          aria-label="テーマ切替"
        >
          <i
            className={`fa-solid ${resolved === 'dark' ? 'fa-sun' : 'fa-moon'}`}
          />
        </button>
        <button
          className={styles.profileBtn}
          onClick={onOpenProfile}
          aria-label="プロフィール"
        >
          <span className={styles.avatar}>{displayName.charAt(0)}</span>
        </button>
      </div>
    </header>
  );
}
