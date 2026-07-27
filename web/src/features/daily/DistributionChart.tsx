import { useMemo } from 'react';
import {
  assignLabelLanes,
  buildDailyDistributionCurve,
  dailyRepsBounds,
  formatDailyProbability,
  truncateLabelName,
  usedLaneCount,
  type DailyParticipant,
} from '../../lib/daily-mission';
import styles from './DistributionChart.module.css';

// viewBox 座標系（レスポンシブに拡縮される）
const W = 360;
const PAD_X = 12;
const LANE_H = 20;
const LANE_TOP = 6;
const MAX_LANES = 12;
const PEAK_GAP = 18; // ラベル段とカーブの間（「ピーク30」の見出しを置く）
const CURVE_H = 132;
const AXIS_H = 26;

/**
 * ラベル幅の目安（衝突判定とはみ出し防止用）。
 * name は font-size 10 の全角想定で約10px/字、目標値は font-size 11 の
 * 数字で約6.5px/字、確率は font-size 9 で約5.2px/字、
 * クリア済みは「✓ 」ぶんを加える。
 * ⚠️ app.js: dailyLabelWidth と同じ式にすること（見た目がズレる）。
 */
function labelWidth(p: DailyParticipant): number {
  return (
    (p.cleared ? 11 : 0) +
    truncateLabelName(p.userName).length * 10 +
    4 +
    String(p.target).length * 6.5 +
    4 +
    formatDailyProbability(p.probability).length * 5.2 +
    6
  );
}

/**
 * 目標回数の分布カーブに、各ユーザーの目標をプロットする。
 * 目標はシードから決まるため、他ユーザーの回数を取得せずに全員分を描ける。
 */
export default function DistributionChart({
  participants,
  unit,
  peak,
}: {
  participants: DailyParticipant[];
  unit: string;
  peak: number;
}) {
  const model = useMemo(() => {
    if (participants.length === 0) return null;

    // 目盛りは抽選されうる範囲だけを映す（0 から描くと分布が右端に寄る）
    const bounds = dailyRepsBounds(peak);
    const lo = Math.min(bounds.min, ...participants.map((p) => p.target));
    const hi = Math.max(bounds.max, ...participants.map((p) => p.target));
    const step = hi - lo > 90 ? 20 : 10;
    const xMin = Math.max(0, (Math.ceil(lo / step) - 1) * step);
    const xMax = (Math.floor(hi / step) + 1) * step;
    const toX = (v: number) =>
      PAD_X + ((v - xMin) / (xMax - xMin)) * (W - PAD_X * 2);

    // ラベル段数に応じてグラフの高さを決める（重なりを段で解消するため）
    const widths = participants.map(labelWidth);
    const xs = participants.map((p) => toX(p.target));
    // 左右端からのはみ出し防止で内側へ寄せてから段を決める。
    // 寄せた後の位置で判定しないと、端のラベルが隣と重なってしまう。
    const labelXs = xs.map((x, i) =>
      Math.min(Math.max(x, widths[i] / 2 + 2), W - widths[i] / 2 - 2),
    );
    const lanes = assignLabelLanes(labelXs, widths, MAX_LANES);
    const laneCount = Math.max(1, usedLaneCount(lanes));
    const curveTop = LANE_TOP + laneCount * LANE_H + PEAK_GAP;
    const baseY = curveTop + CURVE_H;
    const H = baseY + AXIS_H;

    const curve = buildDailyDistributionCurve(xMin, xMax, peak).map((pt) => ({
      x: toX(pt.x),
      y: baseY - pt.y * CURVE_H,
    }));

    const area =
      `M ${toX(xMin)} ${baseY} ` +
      curve.map((pt) => `L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`).join(' ') +
      ` L ${toX(xMax)} ${baseY} Z`;
    const line =
      `M ${curve[0].x.toFixed(2)} ${curve[0].y.toFixed(2)} ` +
      curve
        .slice(1)
        .map((pt) => `L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`)
        .join(' ');

    // カーブ上の y を線形補間で引く（点をカーブに乗せるため）
    const curveYAt = (value: number) => {
      const x = toX(value);
      for (let i = 1; i < curve.length; i++) {
        if (curve[i].x >= x) {
          const a = curve[i - 1];
          const b = curve[i];
          const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
          return a.y + (b.y - a.y) * t;
        }
      }
      return baseY;
    };

    const points = participants.map((p, i) => ({
      p,
      x: xs[i],
      labelX: labelXs[i],
      labelY: LANE_TOP + lanes[i] * LANE_H + LANE_H / 2,
      dotY: curveYAt(p.target),
    }));

    const ticks: number[] = [];
    for (let v = xMin; v <= xMax; v += step) ticks.push(v);

    return {
      H,
      curveTop,
      baseY,
      toX,
      area,
      line,
      points,
      ticks,
      peakX: toX(peak),
    };
  }, [participants, peak]);

  if (!model) return null;
  const { H, curveTop, baseY } = model;

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="みんなの目標回数の分布"
    >
      <defs>
        <linearGradient id="dmArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className={styles.areaTop} />
          <stop offset="100%" className={styles.areaBottom} />
        </linearGradient>
      </defs>

      {/* 目盛り */}
      {model.ticks.map((t) => (
        <g key={t}>
          <line
            x1={model.toX(t)}
            y1={curveTop}
            x2={model.toX(t)}
            y2={baseY}
            className={styles.grid}
          />
          <text x={model.toX(t)} y={baseY + 14} className={styles.tick}>
            {t}
          </text>
        </g>
      ))}
      <text x={W - PAD_X} y={H - 2} className={styles.axisUnit}>
        {unit}
      </text>

      {/* 分布 */}
      <path d={model.area} fill="url(#dmArea)" />
      <path d={model.line} className={styles.curve} />
      <line
        x1={model.peakX}
        y1={curveTop}
        x2={model.peakX}
        y2={baseY}
        className={styles.peakLine}
      />
      <text x={model.peakX} y={curveTop - 5} className={styles.peakLabel}>
        ピーク{peak}
      </text>
      <line
        x1={PAD_X}
        y1={baseY}
        x2={W - PAD_X}
        y2={baseY}
        className={styles.axis}
      />

      {/* 各ユーザー */}
      {model.points.map(({ p, x, labelX, labelY, dotY }) => {
        const cls = p.isMe ? styles.me : p.cleared ? styles.done : styles.todo;
        return (
          <g key={p.userId} className={cls}>
            <polyline
              points={`${labelX},${labelY + 8} ${x},${dotY - 6} ${x},${dotY}`}
              className={styles.connector}
            />
            <circle
              cx={x}
              cy={dotY}
              r={p.isMe ? 5.5 : 4}
              className={styles.dot}
            />
            {p.cleared && (
              <circle
                cx={x}
                cy={dotY}
                r={p.isMe ? 9 : 7.5}
                className={styles.ring}
              />
            )}
            <text x={labelX} y={labelY} className={styles.name}>
              {p.cleared ? '✓ ' : ''}
              {truncateLabelName(p.userName)}
              <tspan className={styles.value}> {p.target}</tspan>
              <tspan className={styles.prob}>
                {' '}
                {formatDailyProbability(p.probability)}
              </tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}
