import { useEffect, useState } from 'react';
import { EmptyState, Skeleton, ViewHeader } from '../components/ui';
import {
  listWeeklyReports,
  loadWeeklyReport,
  markWeeklyReportSeen,
} from '../lib/weekly-report-engine';
import type { WeeklyReport, WeeklyReportSummaryItem } from '../lib/weekly-report';
import {
  DerbyResult,
  ExerciseTable,
  PersonaCards,
  ReportBody,
  RivalryList,
  Section,
  SummaryCards,
  TagTable,
  UserKartes,
  WeeklyChallengeResult,
} from '../features/weekly-report/ReportSections';
import styles from './WeeklyReportView.module.css';

/**
 * ウィークリー（週報 + 分析ダッシュボード）。旧 report.html の移植。
 * 毎週日曜夜に analytics/publish-report.js が weekly_reports へ配信する。
 */
export default function WeeklyReportView({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<WeeklyReportSummaryItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    listWeeklyReports()
      .then((items) => {
        if (!alive) return;
        setList(items);
        if (items.length > 0) {
          setSelectedId(items[0].id);
          // 最新を開いた時点で既読（NEW バッジを消す）
          markWeeklyReportSeen(items[0].id);
        }
      })
      .catch((e) => {
        if (!alive) return;
        console.error('[weekly] 一覧の読み込みに失敗:', e);
        setList([]);
        setError('ウィークリーの読み込みに失敗しました');
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    setLoadingReport(true);
    setError('');
    loadWeeklyReport(selectedId)
      .then((r) => {
        if (!alive) return;
        setReport(r);
        if (!r) setError('このウィークリーは見つかりませんでした。');
      })
      .catch((e) => {
        if (!alive) return;
        console.error('[weekly] 読み込みに失敗:', e);
        setReport(null);
        setError(`読み込みに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
      })
      .finally(() => {
        if (alive) setLoadingReport(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedId]);

  const D = report?.digest;

  return (
    <div className="fade-in">
      <ViewHeader
        icon="fa-newspaper"
        title="ウィークリー"
        action={
          <button className={styles.back} onClick={onBack}>
            <i className="fa-solid fa-arrow-left" /> 戻る
          </button>
        }
      />

      {list && list.length > 0 && (
        <select
          className={styles.weekSel}
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(e.target.value)}
          aria-label="対象週"
        >
          {list.map((r, i) => (
            <option key={r.id} value={r.id}>
              {i === 0 ? '最新: ' : ''}
              {r.coverPeriodLabel}（{r.id}）
            </option>
          ))}
        </select>
      )}

      {list === null || loadingReport ? (
        <Skeleton count={4} />
      ) : error ? (
        <EmptyState icon="fa-triangle-exclamation" message={error} />
      ) : list.length === 0 ? (
        <EmptyState
          icon="fa-newspaper"
          message="まだウィークリーが配信されていません。日曜夜の配信をお待ちください。"
        />
      ) : (
        report &&
        D && (
          // データ → 文章 → その他 の順（先に数字を見て頭に入れてから週報を読む）
          <>
            <Section icon="🏆" title="先週の週間チャレンジ結果">
              <WeeklyChallengeResult wc={D.weeklyChallenge} />
            </Section>
            <Section icon="📅" title="月間ダービー">
              <DerbyResult dby={D.monthlyDerby} />
            </Section>
            <Section icon="📊" title="先週のサマリー">
              <SummaryCards digest={D} />
            </Section>
            <Section icon="🏅" title="二つ名・ペルソナ">
              <PersonaCards users={D.users || []} />
            </Section>
            <Section icon="👤" title="ユーザー別カルテ">
              <UserKartes users={D.users || []} memberNotes={report.memberNotes} />
            </Section>
            <Section icon="📰" title="先週の週報">
              <ReportBody html={report.reportHtml} />
            </Section>
            <Section icon="🔥" title="種目ランキング（人気・勢い）">
              <ExerciseTable digest={D} />
            </Section>
            <Section icon="🏷️" title="タグ別の傾向">
              <TagTable digest={D} />
            </Section>
            <Section icon="⚔️" title="注目ライバル対決（僅差）">
              <RivalryList digest={D} />
            </Section>
          </>
        )
      )}
    </div>
  );
}
