// =====================================================================
// ウィークリー（週報）— Firestore の読み込みと既読管理
//
// weekly_reports/<exportDate>
// {
//   exportDate, coverPeriodLabel,
//   reportHtml, reportMarkdown, memberNotes,
//   digest,                 // 分析ダッシュボードの元データ（build-digest.js）
//   nextWeekExercises,
//   publishedAt,            // serverTimestamp()
// }
// 書き込みは analytics/publish-report.js（admin SDK）のみ。
// =====================================================================
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  sortReportsByIdDesc,
  toWeeklyReport,
  WEEKLY_REPORT_LIST_LIMIT,
  WEEKLY_REPORT_SEEN_KEY,
  type WeeklyReport,
  type WeeklyReportSummaryItem,
} from './weekly-report';

const COL = 'weekly_reports';
/** 既読が変わったことを同じタブ内の他コンポーネントへ知らせるイベント名 */
export const WEEKLY_REPORT_SEEN_EVENT = 'growrep:weekly-report-seen';

function toSummaryItem(id: string, data: Record<string, unknown>): WeeklyReportSummaryItem {
  const label = data.coverPeriodLabel;
  return { id, coverPeriodLabel: typeof label === 'string' && label ? label : id };
}

/** 週セレクタ用の一覧（新しい順） */
export async function listWeeklyReports(): Promise<WeeklyReportSummaryItem[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, COL),
        orderBy('publishedAt', 'desc'),
        limit(WEEKLY_REPORT_LIST_LIMIT),
      ),
    );
    return snap.docs.map((d) => toSummaryItem(d.id, d.data()));
  } catch (e) {
    // publishedAt 欠落などで並べ替えられない時は全件取って docId の降順
    console.warn('[weekly] publishedAt 並べ替え失敗、フォールバック:', e);
    const snap = await getDocs(collection(db, COL));
    return sortReportsByIdDesc(snap.docs.map((d) => toSummaryItem(d.id, d.data())));
  }
}

/** 1週分を読む。無ければ null */
export async function loadWeeklyReport(id: string): Promise<WeeklyReport | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return toWeeklyReport(snap.id, snap.data());
}

let latestIdPromise: Promise<string | null> | null = null;

/**
 * 最新の docId（NEW バッジ用）。1セッションで1回だけ読む。
 * 失敗時は null（バッジを出さないだけ）。
 */
export function fetchLatestWeeklyReportId(): Promise<string | null> {
  if (!latestIdPromise) {
    latestIdPromise = getDocs(
      query(collection(db, COL), orderBy('publishedAt', 'desc'), limit(1)),
    )
      .then((snap) => (snap.empty ? null : snap.docs[0].id))
      .catch((e) => {
        console.warn('[weekly] 最新レポート確認に失敗:', e);
        latestIdPromise = null;
        return null;
      });
  }
  return latestIdPromise;
}

export function getSeenWeeklyReportId(): string | null {
  try {
    return localStorage.getItem(WEEKLY_REPORT_SEEN_KEY);
  } catch {
    return null;
  }
}

export function markWeeklyReportSeen(id: string): void {
  try {
    localStorage.setItem(WEEKLY_REPORT_SEEN_KEY, id);
  } catch {
    /* localStorage 不可の環境は無視（バッジが消えないだけ） */
  }
  window.dispatchEvent(new Event(WEEKLY_REPORT_SEEN_EVENT));
}
