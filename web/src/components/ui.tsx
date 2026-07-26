import type { ReactNode } from 'react';
import styles from './ui.module.css';

export function ViewHeader({
  icon,
  title,
  action,
}: {
  icon: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.viewHeader}>
      <h2>
        <i className={`fa-solid ${icon}`} /> {title}
      </h2>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`${styles.card} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.segmented} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? styles.segOn : styles.seg}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ count = 3 }: { count?: number }) {
  return (
    <div className={styles.skeletonWrap} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.skeleton} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  message,
}: {
  icon: string;
  message: string;
}) {
  return (
    <div className={styles.empty}>
      <i className={`fa-solid ${icon}`} />
      <p>{message}</p>
    </div>
  );
}

export function ExerciseIcon({ icon }: { icon?: string }) {
  return <i className={`fa-solid ${icon || 'fa-dumbbell'}`} />;
}

/** 平均星の表示（0.5刻み）。app.js: renderStarRatingHtml */
export function StarRating({
  avg,
  count,
}: {
  avg: number | null | undefined;
  count: number;
}) {
  if (avg == null || count === 0) {
    return <span className={styles.noRating}>評価なし</span>;
  }
  const full = Math.floor(avg);
  const half = avg - full >= 0.25 && avg - full < 0.75;
  const roundedUp = avg - full >= 0.75;
  return (
    <span className={styles.stars} title={`${avg.toFixed(1)} (${count}件)`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const idx = i + 1;
        let cls = 'fa-regular fa-star';
        if (idx <= full || (roundedUp && idx === full + 1))
          cls = 'fa-solid fa-star';
        else if (half && idx === full + 1) cls = 'fa-solid fa-star-half-stroke';
        return <i key={i} className={cls} />;
      })}
      <span className={styles.ratingNum}>
        {avg.toFixed(1)} <span className={styles.ratingCount}>({count})</span>
      </span>
    </span>
  );
}

export function Barbadge() {
  return (
    <span className={styles.barbadge}>
      <i className="fa-solid fa-stopwatch" /> タイムアタック
    </span>
  );
}
