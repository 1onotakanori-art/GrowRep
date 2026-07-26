import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useMode } from '../../context/ModeContext';
import { getAllPosts } from '../../lib/posts';
import { Skeleton, EmptyState } from '../../components/ui';
import type { Post } from '../../lib/types';
import type { Timestamp } from 'firebase/firestore';
import styles from './ProgressChart.module.css';

interface Point {
  t: number;
  value: number;
}

export default function ProgressChart() {
  const { user } = useAuth();
  const { freeExercises } = useData();
  const { refreshToken } = useMode();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [exKey, setExKey] = useState<string>('');

  const exKeys = useMemo(() => Object.keys(freeExercises), [freeExercises]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const all = await getAllPosts();
        if (!cancelled) setPosts(all);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  useEffect(() => {
    if (!exKey && exKeys.length > 0) setExKey(exKeys[0]);
  }, [exKeys, exKey]);

  const points: Point[] = useMemo(() => {
    if (!user || !exKey) return [];
    return posts
      .filter((p) => p.userId === user.uid && p.exerciseType === exKey)
      .map((p) => ({
        t: (p.timestamp as Timestamp | null)?.toDate?.().getTime() || 0,
        value: Number(p.value) || 0,
      }))
      .filter((p) => p.t > 0)
      .sort((a, b) => a.t - b.t);
  }, [posts, user, exKey]);

  const ex = freeExercises[exKey];
  const isBarbarian = !!ex?.barbarian;

  if (loading) return <Skeleton count={1} />;

  return (
    <div className={styles.wrap}>
      <select
        className={styles.select}
        value={exKey}
        onChange={(e) => setExKey(e.target.value)}
      >
        {exKeys.map((k) => (
          <option key={k} value={k}>
            {freeExercises[k].name}
          </option>
        ))}
      </select>

      {points.length === 0 ? (
        <EmptyState icon="fa-chart-line" message="この種目の記録がありません" />
      ) : (
        <Chart points={points} barbarian={isBarbarian} />
      )}
    </div>
  );
}

function Chart({ points, barbarian }: { points: Point[]; barbarian: boolean }) {
  const W = 320;
  const H = 180;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 24;

  const values = points.map((p) => p.value);
  const maxV = Math.max(...values, 1);
  const minV = Math.min(...values, 0);
  const range = maxV - minV || 1;

  const n = points.length;
  const x = (i: number) =>
    padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) =>
    padT + (1 - (v - minV) / range) * (H - padT - padB);

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`)
    .join(' ');
  const areaPath =
    `M ${x(0)} ${H - padB} ` +
    points.map((p, i) => `L ${x(i)} ${y(p.value)}`).join(' ') +
    ` L ${x(n - 1)} ${H - padB} Z`;

  const best = barbarian ? Math.min(...values) : Math.max(...values);

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg}>
        <defs>
          <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={padL}
            x2={W - padR}
            y1={padT + f * (H - padT - padB)}
            y2={padT + f * (H - padT - padB)}
            className={styles.grid}
          />
        ))}
        <path d={areaPath} fill="url(#pg)" />
        <path d={linePath} className={styles.line} />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={3} className={styles.dot} />
        ))}
        <text x={padL - 6} y={y(maxV)} className={styles.axis} textAnchor="end">
          {Math.round(maxV)}
        </text>
        <text x={padL - 6} y={y(minV)} className={styles.axis} textAnchor="end">
          {Math.round(minV)}
        </text>
      </svg>
      <div className={styles.stats}>
        <span>
          記録数 <strong>{n}</strong>
        </span>
        <span>
          ベスト{' '}
          <strong>
            {best}
            {barbarian ? '秒' : ''}
          </strong>
        </span>
        <span>
          最新{' '}
          <strong>
            {points[n - 1].value}
            {barbarian ? '秒' : ''}
          </strong>
        </span>
      </div>
    </>
  );
}
