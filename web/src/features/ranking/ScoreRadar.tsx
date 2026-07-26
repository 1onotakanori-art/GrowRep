import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import type { UserRecords } from '../../lib/scoring';
import styles from './ScoreRadar.module.css';

const COLORS = [
  '#6c5ce7',
  '#e84393',
  '#00b894',
  '#e17055',
  '#0984e3',
  '#fdcb6e',
  '#a29bfe',
  '#00cec9',
];

export default function ScoreRadar({
  records,
  exerciseKeys,
}: {
  records: UserRecords;
  exerciseKeys: string[];
}) {
  const { user } = useAuth();
  const { freeExercises } = useData();

  const userIds = useMemo(() => Object.keys(records), [records]);
  const [selected, setSelected] = useState<Set<string>>(() => {
    // 初期: 自分 + 上位（最大4人）
    const ranked = Object.entries(records)
      .sort((a, b) => b[1].totalScore - a[1].totalScore)
      .map(([uid]) => uid);
    const init = new Set<string>();
    if (user && records[user.uid]) init.add(user.uid);
    for (const uid of ranked) {
      if (init.size >= 4) break;
      init.add(uid);
    }
    return init;
  });

  const axes = exerciseKeys.filter((k) => freeExercises[k]);
  if (axes.length < 3) return null; // レーダーは3軸以上で表示

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 34;
  const n = axes.length;

  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, r: number) => {
    const a = angleFor(i);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };

  const colorOf = (uid: string) =>
    COLORS[userIds.indexOf(uid) % COLORS.length];

  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  return (
    <div className={styles.wrap}>
      <svg viewBox={`0 0 ${size} ${size}`} className={styles.svg}>
        {/* グリッド */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            points={axes
              .map((_, i) => point(i, R * f).join(','))
              .join(' ')}
            className={styles.grid}
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = point(i, R);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className={styles.spoke} />;
        })}
        {/* 軸ラベル */}
        {axes.map((k, i) => {
          const [x, y] = point(i, R + 16);
          return (
            <text
              key={k}
              x={x}
              y={y}
              className={styles.axisLabel}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {(freeExercises[k]?.name || k).slice(0, 5)}
            </text>
          );
        })}
        {/* ユーザーポリゴン */}
        {[...selected].map((uid) => {
          const rec = records[uid];
          if (!rec) return null;
          const pts = axes
            .map((k, i) => {
              const v = Math.min(rec.scores[k] || 0, 100) / 100;
              return point(i, R * v).join(',');
            })
            .join(' ');
          const c = colorOf(uid);
          return (
            <polygon
              key={uid}
              points={pts}
              fill={c}
              fillOpacity={0.14}
              stroke={c}
              strokeWidth={2}
            />
          );
        })}
      </svg>

      <div className={styles.legend}>
        {Object.entries(records)
          .sort((a, b) => b[1].totalScore - a[1].totalScore)
          .map(([uid, rec]) => {
            const on = selected.has(uid);
            const c = colorOf(uid);
            return (
              <button
                key={uid}
                className={on ? styles.legOn : styles.leg}
                onClick={() => toggle(uid)}
                style={on ? { borderColor: c } : undefined}
              >
                <span className={styles.dot} style={{ background: c }} />
                {rec.userName}
              </button>
            );
          })}
      </div>
    </div>
  );
}
