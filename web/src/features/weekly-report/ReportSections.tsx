import { useState, type ReactNode } from 'react';
import {
  activeReportUsers,
  groupPersonas,
  momentumLabel,
  percentileClass,
  rivalryRatio,
  topPercentLabel,
  type MonthlyDerbyDigest,
  type RankedExercise,
  type UserDigest,
  type WeeklyChallengeDigest,
  type WeeklyDigest,
} from '../../lib/weekly-report';
import styles from './WeeklyReport.module.css';

export function Section({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <span className={styles.sectionIcon}>{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}

const exLabel = (e: { name: string; barbarian?: boolean }) =>
  `${e.name}${e.barbarian ? '⏱' : ''}`;

// ---------------------------------------------------------------------
// 先週の週間チャレンジ結果
// ---------------------------------------------------------------------
export function WeeklyChallengeResult({ wc }: { wc?: WeeklyChallengeDigest | null }) {
  if (!wc || !wc.standings?.length) {
    return <Empty>先週の週間チャレンジ記録はありません。</Empty>;
  }
  const champ = wc.champion;
  const exercises = wc.exercises || [];
  return (
    <>
      <div className={styles.champCard}>
        <span className={styles.champCrown}>
          <i className="fa-solid fa-crown" />
        </span>
        <div className={styles.champBody}>
          <div className={styles.champName}>
            {champ?.userName ?? '-'}
            {champ?.perfect && <span className={styles.pill}>完全優勝</span>}
          </div>
          <div className={styles.lbl}>
            先週の王者（{champ?.totalScore ?? '-'} / {wc.maxScore ?? '-'}点）
            {wc.leadMargin != null && ` ・2位と${wc.leadMargin}点差`}
          </div>
          <div className={styles.lbl}>
            種目: {exercises.map(exLabel).join(' / ') || '-'}
            {wc.period?.label && `（${wc.period.label}）`}
          </div>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.tbl}>
          <thead>
            <tr>
              <th>順位</th>
              <th>名前</th>
              <th className={styles.num}>合計</th>
              {exercises.map((e, i) => (
                <th key={i} className={styles.num}>
                  {exLabel(e)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {wc.standings.map((s, i) => (
              <tr key={i}>
                <td className={s.rank === 1 ? styles.rank1 : undefined}>
                  {s.rank === 1 ? '👑 ' : ''}
                  {s.rank}
                </td>
                <td>{s.userName}</td>
                <td className={styles.num}>
                  <b>{s.totalScore}</b>
                </td>
                {(s.perExercise || []).map((p, j) => (
                  <td
                    key={j}
                    className={`${styles.num} ${p.isLeader ? styles.leader : ''}`}
                  >
                    {p.value == null ? (
                      '—'
                    ) : (
                      <>
                        {p.value}
                        <span className={styles.sub}>({p.score})</span>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
// 月間ダービー
// ---------------------------------------------------------------------
export function DerbyResult({ dby }: { dby?: MonthlyDerbyDigest | null }) {
  if (!dby || !dby.standings?.length) {
    return <Empty>月間ダービーのデータはまだありません。</Empty>;
  }
  return (
    <>
      <div className={styles.card}>
        <div className={styles.statSmall}>
          {dby.label || '月間ダービー'}{' '}
          {dby.monthOver ? (
            <span className={`${styles.pill} ${styles.pillGold}`}>確定</span>
          ) : (
            <span className={styles.pill}>途中経過・暫定</span>
          )}
        </div>
        <div className={styles.lbl}>
          {dby.monthOver ? '月間チャンプ' : '暫定首位'}:{' '}
          <b>{dby.leader?.userName || '-'}</b>（{dby.leader?.total ?? '-'}点）
          {dby.leadMargin != null && ` ・2位と${dby.leadMargin}点差`}
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.tbl}>
          <thead>
            <tr>
              <th>順位</th>
              <th>名前</th>
              <th className={styles.num}>合計</th>
              {(dby.weeks || []).map((w) => (
                <th key={w.weekNum} className={styles.num} title={w.label}>
                  第{w.weekNum}週
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dby.standings.map((s, i) => (
              <tr key={i}>
                <td className={s.rank === 1 ? styles.rank1 : undefined}>{s.rank}</td>
                <td>{s.userName}</td>
                <td className={styles.num}>
                  <b>{s.total}</b>
                </td>
                {(s.weeklyScores || []).map((v, j) => (
                  <td key={j} className={styles.num}>
                    {v ? v : '−'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
// 先週のサマリー
// ---------------------------------------------------------------------
export function SummaryCards({ digest }: { digest: WeeklyDigest }) {
  const s = digest.summary;
  if (!s) return <Empty>サマリーはありません。</Empty>;
  const cards: { n: ReactNode; l: string; small?: boolean }[] = [
    { n: s.postsThisWeek, l: '先週の投稿数' },
    { n: s.activeUsersThisWeek, l: '先週の活動人数' },
    { n: s.hottestExercise || '-', l: '先週の人気種目', small: true },
    {
      n: s.mvp ? s.mvp.userName : '-',
      l: `先週のMVP${s.mvp ? `（PB${s.mvp.pbThisWeek}・投稿${s.mvp.postsThisWeek}）` : ''}`,
      small: true,
    },
    { n: s.totalPosts, l: '累計投稿数' },
    { n: `${s.activeUsers}/${s.totalUsers}`, l: '活動ユーザー' },
    { n: s.totalExercises, l: '種目数' },
  ];
  return (
    <div className={styles.cards}>
      {cards.map((c, i) => (
        <div key={i} className={styles.card}>
          <div className={c.small ? styles.statSmall : styles.stat}>{c.n}</div>
          <div className={styles.lbl}>{c.l}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// 二つ名・ペルソナ
// ---------------------------------------------------------------------
export function PersonaCards({ users }: { users: UserDigest[] }) {
  const groups = groupPersonas(users);
  if (groups.length === 0) return <Empty>該当者なし</Empty>;
  return (
    <div className={styles.cards}>
      {groups.map((g) => (
        <div key={g.label} className={styles.card}>
          <div className={`${styles.statSmall} ${styles.gold}`}>{g.label}</div>
          <div className={styles.lbl}>{g.desc}</div>
          <div className={styles.holders}>
            {g.holders.map((h, i) => (
              <span key={i}>
                {i > 0 && '、'}
                {h.user}
                {h.value != null && <span className={styles.sub}>({h.value})</span>}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// ユーザー別カルテ
// ---------------------------------------------------------------------
const WD = ['日', '月', '火', '水', '木', '金', '土'];

const RADAR_LABEL_MAX = 6;

function TagRadar({ tagStrength }: { tagStrength: Record<string, number> }) {
  const labels = Object.keys(tagStrength);
  // 横に余白を取り、左右のラベルは外側へ揃えて切れないようにする
  const W = 320;
  const H = 250;
  const cx = W / 2;
  const cy = H / 2;
  const R = 86;
  const n = labels.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, r: number) => [
    cx + Math.cos(angle(i)) * r,
    cy + Math.sin(angle(i)) * r,
  ];
  const value = (t: string) => Math.max(0, Math.min(100, tagStrength[t] || 0));
  const short = (t: string) =>
    t.length > RADAR_LABEL_MAX ? `${t.slice(0, RADAR_LABEL_MAX)}…` : t;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.radar} role="img" aria-label="タグ別の強み">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={labels.map((_, i) => pt(i, R * f).join(',')).join(' ')}
          className={styles.radarGrid}
        />
      ))}
      {labels.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className={styles.radarGrid} />;
      })}
      <polygon
        points={labels.map((t, i) => pt(i, (R * value(t)) / 100).join(',')).join(' ')}
        className={styles.radarArea}
      />
      {labels.map((t, i) => {
        const [x, y] = pt(i, R + 8);
        const cos = Math.cos(angle(i));
        const anchor = cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle';
        return (
          <text key={t} x={x} y={y} className={styles.radarLabel} textAnchor={anchor} dominantBaseline="middle">
            <title>{`${t}: ${value(t)}`}</title>
            {short(t)}
          </text>
        );
      })}
    </svg>
  );
}

function WeekdayBars({ weekday }: { weekday: number[] }) {
  const max = Math.max(1, ...weekday);
  return (
    <div className={styles.wdBars}>
      {WD.map((label, i) => {
        const v = weekday[i] || 0;
        return (
          <div key={label} className={styles.wdCol} title={`${label}: ${v}件`}>
            <span className={styles.wdVal}>{v || ''}</span>
            <span className={styles.wdTrack}>
              <span className={styles.wdBar} style={{ height: `${(v / max) * 100}%` }} />
            </span>
            <span className={styles.wdLabel}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function RankList({ items, empty }: { items?: RankedExercise[]; empty: string }) {
  if (!items?.length) return <div className={styles.emptyLine}>{empty}</div>;
  return (
    <ul className={styles.lst}>
      {items.map((e, i) => (
        <li key={i}>
          <span>{e.name}</span>
          <span className={`${styles.pct} ${styles[percentileClass(e.percentile)]}`}>
            {topPercentLabel(e.percentile)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function UserKarte({ u, note }: { u: UserDigest; note?: string }) {
  const [open, setOpen] = useState(false);
  const badges = u.badges || [];
  const tagKeys = Object.keys(u.tagStrength || {});
  return (
    <div className={styles.ucard}>
      <button className={styles.uhead} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={styles.uname}>{u.userName}</span>
        {badges.length > 0 ? (
          badges.slice(0, 2).map((b) => (
            <span key={b.label} className={styles.unameBadge} title={b.desc}>
              {b.label}
            </span>
          ))
        ) : (
          <span className={`${styles.unameBadge} ${styles.muted}`}>称号なし</span>
        )}
        <span className={styles.utype}>{u.type || '-'}</span>
        <i className={`fa-solid fa-chevron-down ${styles.uchev} ${open ? styles.uchevOpen : ''}`} />
      </button>
      {open && (
        <div className={styles.ubody}>
          <div className={styles.badges}>
            {badges.length > 0 ? (
              badges.map((b) => (
                <span key={b.label} className={styles.badge} title={b.desc}>
                  {b.label}
                </span>
              ))
            ) : (
              <span className={`${styles.badge} ${styles.muted}`}>称号なし</span>
            )}
          </div>
          <div className={styles.mini}>
            <div><b>{u.totalPosts}</b><span>投稿</span></div>
            <div><b>{u.activeDays}</b><span>活動日</span></div>
            <div><b>{u.longestStreak}</b><span>最長連続</span></div>
            <div><b>{u.overallSkill ?? '-'}</b><span>総合力%</span></div>
          </div>
          <div className={styles.mini}>
            <div><b>{u.social?.likesReceived ?? 0}</b><span>被いいね</span></div>
            <div><b>{u.social?.likesGiven ?? 0}</b><span>応援した</span></div>
            <div><b>{u.social?.commentsReceived ?? 0}</b><span>被コメ</span></div>
            <div><b>{u.social?.commentsGiven ?? 0}</b><span>コメした</span></div>
          </div>
          {tagKeys.length >= 3 && (
            <>
              <div className={styles.sectLbl}>タグ別の強み（相対パーセンタイル）</div>
              <TagRadar tagStrength={u.tagStrength!} />
            </>
          )}
          <div className={styles.row2}>
            <div>
              <div className={styles.sectLbl}>得意トップ3</div>
              <RankList items={u.strengths} empty="比較データ不足" />
            </div>
            <div>
              <div className={styles.sectLbl}>苦手ワースト3</div>
              <RankList items={u.weaknesses} empty="-" />
            </div>
          </div>
          <div className={styles.sectLbl}>急成長中</div>
          {u.growthStars?.length ? (
            <ul className={styles.lst}>
              {u.growthStars.map((e, i) => (
                <li key={i}>
                  <span>{e.name}</span>
                  <span className={styles.trendUp}>+{e.relSlopeWeekPct}%/週</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.emptyLine}>該当なし</div>
          )}
          <div className={styles.sectLbl}>未開拓タグ（次の挑戦候補）</div>
          <div className={styles.chips}>
            {u.neglectedTags?.length ? (
              u.neglectedTags.map((t) => (
                <span key={t} className={styles.chip}>
                  {t}
                </span>
              ))
            ) : (
              <span className={styles.emptyLine}>なし</span>
            )}
          </div>
          {u.weekday && (
            <>
              <div className={styles.sectLbl}>曜日別の投稿</div>
              <WeekdayBars weekday={u.weekday} />
            </>
          )}
          {note && (
            <>
              <div className={styles.sectLbl}>ひとことMC（Cowork）</div>
              <div className={styles.mc}>
                <i className="fa-solid fa-comment-dots" />
                <span>{note}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function UserKartes({
  users,
  memberNotes,
}: {
  users: UserDigest[];
  memberNotes: Record<string, string>;
}) {
  const actives = activeReportUsers(users);
  if (actives.length === 0) return <Empty>カルテはありません。</Empty>;
  return (
    <div className={styles.ulist}>
      {actives.map((u) => (
        <UserKarte key={u.userName} u={u} note={memberNotes[u.userName]} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// 週報本文（Cowork）
// ---------------------------------------------------------------------
export function ReportBody({ html }: { html: string }) {
  if (!html) return <Empty>週報がありません。</Empty>;
  // reportHtml はサービスアカウントだけが書ける weekly_reports 由来。
  // toWeeklyReport で sanitizeReportHtml 済み。
  return <div className={styles.report} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ---------------------------------------------------------------------
// 種目ランキング（人気・勢い）
// ---------------------------------------------------------------------
export function ExerciseTable({ digest }: { digest: WeeklyDigest }) {
  const list = digest.exercises;
  if (!list?.length) return <Empty>種目データはありません。</Empty>;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.tbl}>
        <thead>
          <tr>
            <th>種目</th>
            <th>タグ</th>
            <th className={styles.num}>累計</th>
            <th className={styles.num}>人数</th>
            <th className={styles.num}>今週</th>
            <th className={styles.num}>勢い</th>
            <th>トップ</th>
            <th>評価</th>
            <th>作成者</th>
          </tr>
        </thead>
        <tbody>
          {list.map((e, i) => {
            const mom = momentumLabel(e.momentum);
            return (
              <tr key={i}>
                <td>{e.name}</td>
                <td>
                  {e.tags?.length
                    ? e.tags.map((t) => (
                        <span key={t} className={styles.chip}>
                          {t}
                        </span>
                      ))
                    : '-'}
                </td>
                <td className={styles.num}>{e.totalPosts}</td>
                <td className={styles.num}>{e.uniqueUsers}</td>
                <td className={styles.num}>{e.recent7}</td>
                <td className={`${styles.num} ${styles[`mom_${mom.dir}`]}`}>{mom.text}</td>
                <td>{e.topUser || '-'}</td>
                <td>
                  {e.rating && e.rating.count > 0
                    ? `★${e.rating.avg} (${e.rating.count})`
                    : '-'}
                </td>
                <td className={styles.sub}>{e.createdByName || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------
// タグ別の傾向
// ---------------------------------------------------------------------
export function TagTable({ digest }: { digest: WeeklyDigest }) {
  const list = digest.tags;
  if (!list?.length) return <Empty>タグデータはありません。</Empty>;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.tbl}>
        <thead>
          <tr>
            <th>タグ</th>
            <th className={styles.num}>種目数</th>
            <th className={styles.num}>投稿数</th>
            <th>タグ王（相対実力）</th>
          </tr>
        </thead>
        <tbody>
          {list.map((t) => (
            <tr key={t.tag}>
              <td>{t.tag}</td>
              <td className={styles.num}>{t.exerciseCount}</td>
              <td className={styles.num}>{t.postCount}</td>
              <td>
                {t.king ? (
                  <>
                    {t.king.user} <span className={styles.sub}>({t.king.score})</span>
                  </>
                ) : (
                  '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------
// 注目ライバル対決（僅差）
// ---------------------------------------------------------------------
export function RivalryList({ digest }: { digest: WeeklyDigest }) {
  const list = digest.rivalries;
  if (!list?.length) return <Empty>僅差の対決はありません</Empty>;
  return (
    <div className={styles.rivals}>
      {list.map((r, i) => (
        <div key={i} className={styles.card}>
          <div className={styles.vs}>
            <span className={styles.who}>
              🥇 {r.leader} ({r.leaderValue})
            </span>
            <span className={styles.gap}>差 {r.gapPct}%</span>
            <span className={`${styles.who} ${styles.sub}`}>
              {r.challenger} ({r.challengerValue}) 🥈
            </span>
          </div>
          <div className={styles.lbl}>{r.exercise}</div>
          <div className={styles.bar}>
            <i style={{ width: `${rivalryRatio(r)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
