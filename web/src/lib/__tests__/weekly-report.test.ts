import { describe, expect, it } from 'vitest';
import {
  activeReportUsers,
  groupPersonas,
  isWeeklyReportUnseen,
  momentumLabel,
  percentileClass,
  rivalryRatio,
  sanitizeReportHtml,
  sortReportsByIdDesc,
  topPercentLabel,
  toWeeklyReport,
  type UserDigest,
} from '../weekly-report';

const user = (userName: string, extra: Partial<UserDigest> = {}): UserDigest => ({
  userName,
  totalPosts: 1,
  activeDays: 1,
  longestStreak: 1,
  social: { likesReceived: 0, likesGiven: 0, commentsReceived: 0, commentsGiven: 0 },
  ...extra,
});

describe('isWeeklyReportUnseen', () => {
  it('最新が既読と違えば未読', () => {
    expect(isWeeklyReportUnseen('2026-10-18', '2026-10-11')).toBe(true);
    expect(isWeeklyReportUnseen('2026-10-18', null)).toBe(true);
  });
  it('同じなら既読、配信がまだ無ければ未読扱いしない', () => {
    expect(isWeeklyReportUnseen('2026-10-18', '2026-10-18')).toBe(false);
    expect(isWeeklyReportUnseen(null, null)).toBe(false);
  });
});

describe('sortReportsByIdDesc', () => {
  it('docId（日付）の新しい順に上限件数まで', () => {
    const items = ['2026-09-27', '2026-10-11', '2026-10-04'].map((id) => ({ id }));
    expect(sortReportsByIdDesc(items, 2).map((x) => x.id)).toEqual([
      '2026-10-11',
      '2026-10-04',
    ]);
  });
});

describe('パーセンタイル表示', () => {
  it('66以上=hi、33以下=lo、間=mid', () => {
    expect(percentileClass(66)).toBe('hi');
    expect(percentileClass(65.9)).toBe('mid');
    expect(percentileClass(33)).toBe('lo');
  });
  it('上位n%は 100−パーセンタイル', () => {
    expect(topPercentLabel(90)).toBe('上位10%');
    expect(topPercentLabel(12.4)).toBe('上位88%');
  });
});

describe('groupPersonas', () => {
  it('称号ごとに保持者をまとめ、決まった順に並べる', () => {
    const groups = groupPersonas([
      user('A', { badges: [{ label: '夜型', desc: '夜に投稿', value: null }] }),
      user('B', {
        badges: [
          { label: '投稿王', desc: '最多投稿', value: 30 },
          { label: '夜型', desc: '夜に投稿' },
        ],
      }),
      user('C', { badges: [{ label: '謎の称号', desc: '?' }] }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(['投稿王', '夜型', '謎の称号']);
    expect(groups[0].holders).toEqual([{ user: 'B', value: 30 }]);
    expect(groups[1].holders.map((h) => h.user)).toEqual(['A', 'B']);
  });
});

describe('activeReportUsers', () => {
  it('投稿0件の人はカルテに出さない', () => {
    const list = activeReportUsers([user('A'), user('B', { totalPosts: 0 })]);
    expect(list.map((u) => u.userName)).toEqual(['A']);
  });
});

describe('momentumLabel / rivalryRatio', () => {
  it('勢いの向き', () => {
    expect(momentumLabel(3)).toEqual({ text: '▲3', dir: 'up' });
    expect(momentumLabel(-2)).toEqual({ text: '▼2', dir: 'down' });
    expect(momentumLabel(0)).toEqual({ text: '−', dir: 'flat' });
  });
  it('バー幅は 0〜100 に収める', () => {
    expect(rivalryRatio({ leaderValue: 50, challengerValue: 45 })).toBe(90);
    expect(rivalryRatio({ leaderValue: 0, challengerValue: 5 })).toBe(0);
    expect(rivalryRatio({ leaderValue: 10, challengerValue: 12 })).toBe(100);
  });
});

describe('sanitizeReportHtml', () => {
  it('script / iframe / イベント属性 / javascript: を落とす', () => {
    const html =
      '<h2>見出し</h2><script>alert(1)</script><p onclick="x()" onmouseover=\'y()\'>本文</p>' +
      '<iframe src="https://example.com"></iframe><a href="javascript:alert(1)">リンク</a>' +
      '<img src=x onerror=alert(1)>';
    const out = sanitizeReportHtml(html);
    expect(out).not.toMatch(/script|iframe|onclick|onmouseover|onerror|javascript:/i);
    expect(out).toContain('<h2>見出し</h2>');
    expect(out).toContain('本文');
  });
  it('普通の Markdown 出力はそのまま', () => {
    const html = '<ul><li><strong>A</strong>: 好調</li></ul><table><tr><td>1</td></tr></table>';
    expect(sanitizeReportHtml(html)).toBe(html);
  });
});

describe('toWeeklyReport', () => {
  it('欠けたフィールドを埋める', () => {
    const r = toWeeklyReport('2026-10-18', {});
    expect(r).toEqual({
      id: '2026-10-18',
      coverPeriodLabel: '2026-10-18',
      reportHtml: '',
      memberNotes: {},
      digest: {},
    });
  });
  it('値があればそのまま使い、HTML は無害化する', () => {
    const r = toWeeklyReport('2026-10-18', {
      coverPeriodLabel: '10/12〜10/16',
      reportHtml: '<p>週報</p><script>x</script>',
      memberNotes: { A: 'いい感じ' },
      digest: { rivalries: [] },
    });
    expect(r.coverPeriodLabel).toBe('10/12〜10/16');
    expect(r.reportHtml).toBe('<p>週報</p>');
    expect(r.memberNotes).toEqual({ A: 'いい感じ' });
    expect(r.digest).toEqual({ rivalries: [] });
  });
});
