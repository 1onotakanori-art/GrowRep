import type { Mode } from '../lib/types';
import styles from './BottomNav.module.css';

export type NavKey = 'home' | 'post' | 'ranking' | 'center' | 'mypage';

interface Item {
  key: NavKey;
  label: string;
  icon: string;
}

const BASE: Item[] = [
  { key: 'home', label: 'ホーム', icon: 'fa-house' },
  { key: 'post', label: '投稿', icon: 'fa-pen-to-square' },
  { key: 'ranking', label: 'ランキング', icon: 'fa-ranking-star' },
];

export default function BottomNav({
  active,
  onChange,
  mode,
}: {
  active: NavKey;
  onChange: (k: NavKey) => void;
  mode: Mode;
}) {
  const center: Item =
    mode === 'weekly'
      ? { key: 'center', label: 'チャレンジ', icon: 'fa-trophy' }
      : { key: 'center', label: '種目', icon: 'fa-dumbbell' };

  const items: Item[] = [
    ...BASE,
    center,
    { key: 'mypage', label: 'マイページ', icon: 'fa-user' },
  ];

  return (
    <nav className={styles.nav}>
      {items.map((it) => {
        const on = active === it.key;
        return (
          <button
            key={it.key}
            className={on ? styles.itemOn : styles.item}
            onClick={() => onChange(it.key)}
            aria-current={on ? 'page' : undefined}
          >
            <i className={`fa-solid ${it.icon}`} />
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
