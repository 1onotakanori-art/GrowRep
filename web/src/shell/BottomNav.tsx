import type { Mode } from '../lib/types';
import styles from './BottomNav.module.css';

export type NavKey =
  | 'home'
  | 'daily'
  | 'timer'
  | 'post'
  | 'ranking'
  | 'center'
  | 'mypage';

interface Item {
  key: NavKey;
  label: string;
  icon: string;
}

const BASE: Item[] = [
  { key: 'home', label: 'ホーム', icon: 'fa-house' },
  { key: 'daily', label: 'デイリー', icon: 'fa-bullseye' },
  { key: 'timer', label: 'タイマー', icon: 'fa-stopwatch' },
  { key: 'post', label: '投稿', icon: 'fa-pen-to-square' },
  { key: 'ranking', label: 'ランキング', icon: 'fa-ranking-star' },
];

export default function BottomNav({
  active,
  onChange,
  mode,
  dailyPending = false,
}: {
  active: NavKey;
  onChange: (k: NavKey) => void;
  mode: Mode;
  /** 今日のデイリーミッションが未クリアなら赤ドットを出す。 */
  dailyPending?: boolean;
}) {
  const center: Item =
    mode === 'weekly'
      ? { key: 'center', label: 'チャレンジ', icon: 'fa-trophy' }
      : mode === 'raid'
        ? { key: 'center', label: '得点', icon: 'fa-ranking-star' }
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
            <span className={styles.iconWrap}>
              <i className={`fa-solid ${it.icon}`} />
              {it.key === 'daily' && dailyPending && (
                <span className={styles.dot} />
              )}
            </span>
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
