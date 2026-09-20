import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDropset } from '../../context/DropsetContext';
import { EmptyState, Skeleton } from '../../components/ui';
import {
  buildStepChart,
  formatWeight,
  progressOf,
  weightHistory,
  type ChartGeometry,
  type WeightPoint,
} from '../../lib/dropset';
import styles from './DropsetWeightChart.module.css';

const GEOM: ChartGeometry = {
  width: 320,
  height: 180,
  padL: 36,
  padR: 12,
  padT: 14,
  padB: 24,
};

function formatDay(t: number): string {
  return new Date(t).toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  });
}

export default function DropsetWeightChart() {
  const { user } = useAuth();
  const { exercises, attempts, loading } = useDropset();
  const [exKey, setExKey] = useState('');

  const exKeys = useMemo(
    () =>
      Object.entries(exercises)
        .sort(([, a], [, b]) => a.name.localeCompare(b.name, 'ja'))
        .map(([k]) => k),
    [exercises],
  );

  useEffect(() => {
    if (exKeys.length === 0) {
      if (exKey) setExKey('');
      return;
    }
    if (!exKey || !exKeys.includes(exKey)) setExKey(exKeys[0]);
  }, [exKeys, exKey]);

  const points = useMemo(
    () => (user && exKey ? weightHistory(attempts, user.uid, exKey) : []),
    [attempts, user, exKey],
  );

  const progress = useMemo(
    () =>
      user && exKey
        ? progressOf(attempts, user.uid, exKey, exercises[exKey])
        : null,
    [attempts, user, exKey, exercises],
  );

  if (loading) return <Skeleton count={1} />;

  if (exKeys.length === 0) {
    return (
      <EmptyState
        icon="fa-chart-line"
        message="種目がまだありません。「種目」タブから追加できます"
      />
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>
          <i className="fa-solid fa-chart-line" /> 重量の推移
        </span>
        <select
          className={styles.select}
          value={exKey}
          onChange={(e) => setExKey(e.target.value)}
        >
          {exKeys.map((k) => (
            <option key={k} value={k}>
              {exercises[k].name}
            </option>
          ))}
        </select>
      </div>

      {points.length === 0 ? (
        <EmptyState
          icon="fa-flag-checkered"
          message="この種目はまだクリアした記録がありません"
        />
      ) : (
        <StepChart
          points={points}
          suggested={progress?.suggestedWeight ?? null}
        />
      )}
    </div>
  );
}

/** クリア重量の階段グラフ。座標計算は lib/dropset.ts: buildStepChart。 */
function StepChart({
  points,
  suggested,
}: {
  points: WeightPoint[];
  suggested: number | null;
}) {
  const layout = buildStepChart(points, GEOM);
  if (!layout) return null;

  const { width, height, padL, padB } = GEOM;
  const { linePath, areaPath, first, peak, rightX, tMin, tMax } = layout;
  const innerH = height - GEOM.padT - padB;
  const n = layout.points.length;

  return (
    <>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.svg}>
        <defs>
          <linearGradient id="dsg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={padL}
            x2={rightX}
            y1={GEOM.padT + f * innerH}
            y2={GEOM.padT + f * innerH}
            className={styles.grid}
          />
        ))}

        <path d={areaPath} fill="url(#dsg)" />
        <path d={linePath} className={styles.line} />

        {layout.points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} className={styles.dot} />
        ))}

        <text
          x={padL - 6}
          y={layout.points[n - 1].y}
          className={styles.axis}
          textAnchor="end"
        >
          {formatWeight(peak)}
        </text>
        {n > 1 && (
          <text
            x={padL - 6}
            y={layout.points[0].y}
            className={styles.axis}
            textAnchor="end"
          >
            {formatWeight(first)}
          </text>
        )}
        <text
          x={padL}
          y={height - padB + 12}
          className={styles.axis}
          textAnchor="start"
        >
          {formatDay(tMin)}
        </text>
        {tMax > tMin && (
          <text
            x={rightX}
            y={height - padB + 12}
            className={styles.axis}
            textAnchor="end"
          >
            {formatDay(tMax)}
          </text>
        )}
      </svg>

      <div className={styles.stats}>
        <span>
          クリア<strong>{n}</strong>回
        </span>
        <span>
          現在<strong>{formatWeight(peak)}</strong>kg
        </span>
        <span>
          伸び<strong>+{formatWeight(peak - first)}</strong>kg
        </span>
      </div>

      {suggested != null && (
        <p className={styles.next}>
          <i className="fa-solid fa-flag-checkered" /> 次の挑戦は{' '}
          <strong>{formatWeight(suggested)}kg</strong>
        </p>
      )}
    </>
  );
}
