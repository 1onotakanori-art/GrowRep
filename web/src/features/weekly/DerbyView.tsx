import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import {
  computeMonthlyDerbyData,
  getCurrentDerbyYearMonth,
  type DerbyData,
} from '../../lib/derby';
import { Skeleton, EmptyState } from '../../components/ui';
import styles from './DerbyView.module.css';

function monthOptions(): { year: number; month: number; label: string }[] {
  const { year, month } = getCurrentDerbyYearMonth();
  const opts: { year: number; month: number; label: string }[] = [];
  let y = year;
  let m = month;
  for (let i = 0; i < 6; i++) {
    opts.push({ year: y, month: m, label: `${y}年${m}月` });
    m--;
    if (m < 1) {
      m = 12;
      y--;
    }
  }
  return opts;
}

export default function DerbyView() {
  const { user } = useAuth();
  const { freeExercises, weeklyChallenge } = useData();
  const options = useMemo(monthOptions, []);
  const [sel, setSel] = useState(0);
  const [data, setData] = useState<DerbyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { year, month } = options[sel];
    (async () => {
      try {
        const d = await computeMonthlyDerbyData(
          year,
          month,
          freeExercises,
          weeklyChallenge,
        );
        if (!cancelled) setData(d);
      } catch (e) {
        console.error('[ダービー] 失敗:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sel, options, freeExercises, weeklyChallenge]);

  const summaryRanked = useMemo(() => {
    if (!data) return [];
    return Object.values(data.userSummary).sort((a, b) => b.total - a.total);
  }, [data]);

  return (
    <div className={styles.wrap}>
      <select
        className={styles.monthSel}
        value={sel}
        onChange={(e) => setSel(Number(e.target.value))}
      >
        {options.map((o, i) => (
          <option key={i} value={i}>
            {o.label}
          </option>
        ))}
      </select>

      {loading ? (
        <Skeleton count={3} />
      ) : !data || data.weeks.length === 0 ? (
        <EmptyState icon="fa-calendar-days" message="この月のデータはありません" />
      ) : (
        <>
          {data.monthlyChamp && (
            <div className={styles.champBanner}>
              <span className={styles.trophy}>🏆</span>
              <div>
                <span className={styles.champLabel}>月間チャンプ</span>
                <span className={styles.champName}>
                  {data.monthlyChamp.userName}
                </span>
              </div>
              <span className={styles.champTotal}>
                {Math.round(data.monthlyChamp.total)}pt
              </span>
            </div>
          )}

          {/* 累計ランキング表 */}
          <div
            className={styles.table}
            style={{ ['--weeks' as string]: String(data.weeks.length) }}
          >
            <div className={styles.tRowHead}>
              <span className={styles.tRank}>#</span>
              <span className={styles.tName}>選手</span>
              {data.weeks.map((w) => (
                <span key={w.docId} className={styles.tWeek}>
                  {w.weekNum}週
                </span>
              ))}
              <span className={styles.tTotal}>合計</span>
            </div>
            {summaryRanked.map((u, i) => (
              <div
                key={u.userId}
                className={`${styles.tRow} ${u.userId === user?.uid ? styles.me : ''}`}
              >
                <span className={styles.tRank}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </span>
                <span className={styles.tName}>{u.userName}</span>
                {u.weeklyScores.map((s, wi) => (
                  <span key={wi} className={styles.tWeek}>
                    {Math.round(s)}
                  </span>
                ))}
                <span className={styles.tTotal}>{Math.round(u.total)}</span>
              </div>
            ))}
          </div>

          {/* 週別詳細 */}
          {data.weeks.map((w) => (
            <div key={w.docId} className={styles.weekCard}>
              <div className={styles.weekHead}>
                <span>{w.weekLabel}</span>
                <div className={styles.weekExs}>
                  {w.exerciseKeys.map((k) => (
                    <span key={k} className={styles.weekEx}>
                      <i
                        className={`fa-solid ${freeExercises[k]?.icon || 'fa-dumbbell'}`}
                      />
                      {w.exerciseNames[k]}
                    </span>
                  ))}
                </div>
              </div>
              {w.rankList.slice(0, 3).map((u) => (
                <div key={u.userId} className={styles.weekRow}>
                  <span className={styles.weekRank}>
                    {u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : u.rank}
                  </span>
                  <span className={styles.weekName}>{u.userName}</span>
                  <span className={styles.weekScore}>
                    {Math.round(u.totalScore)}%
                  </span>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
