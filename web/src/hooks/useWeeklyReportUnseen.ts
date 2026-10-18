import { useEffect, useState } from 'react';
import {
  fetchLatestWeeklyReportId,
  getSeenWeeklyReportId,
  WEEKLY_REPORT_SEEN_EVENT,
} from '../lib/weekly-report-engine';
import { isWeeklyReportUnseen } from '../lib/weekly-report';

/** 最新のウィークリーが未読なら true（NEW バッジ・ホームのバナー用） */
export function useWeeklyReportUnseen(): boolean {
  const [latestId, setLatestId] = useState<string | null>(null);
  const [seenId, setSeenId] = useState<string | null>(getSeenWeeklyReportId);

  useEffect(() => {
    let alive = true;
    fetchLatestWeeklyReportId().then((id) => {
      if (alive) setLatestId(id);
    });
    const onSeen = () => setSeenId(getSeenWeeklyReportId());
    window.addEventListener(WEEKLY_REPORT_SEEN_EVENT, onSeen);
    return () => {
      alive = false;
      window.removeEventListener(WEEKLY_REPORT_SEEN_EVENT, onSeen);
    };
  }, []);

  return isWeeklyReportUnseen(latestId, seenId);
}
