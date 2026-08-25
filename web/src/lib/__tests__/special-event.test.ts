import { describe, it, expect } from 'vitest';
import {
  getProposableWeeks,
  resolveProposalStatus,
  needsResponseFrom,
  isTargetWeekUpcoming,
  summarizeResponses,
  SPECIAL_EVENT_WEEK_CHOICES,
  type ApprovalResponse,
} from '../special-event';

// JST の壁時計時刻から UTC の Date を作るヘルパー（JST = UTC+9）
const jst = (y: number, mo: number, d: number, h = 0, mi = 0): Date =>
  new Date(Date.UTC(y, mo - 1, d, h - 9, mi));

describe('getProposableWeeks（開始日は月曜のみ・次週から4週分）', () => {
  it('次週の月曜を先頭に4週分を返す', () => {
    // 2026-07-22(水) 13:00 JST → 今週は 7/19(日)17:00 起点、月曜は 7/20
    const weeks = getProposableWeeks(jst(2026, 7, 22, 13));
    expect(weeks).toHaveLength(SPECIAL_EVENT_WEEK_CHOICES);
    expect(weeks.map((w) => w.mondayKey)).toEqual([
      '2026-07-27',
      '2026-08-03',
      '2026-08-10',
      '2026-08-17',
    ]);
    expect(weeks[0].weeksAhead).toBe(1);
  });

  it('週開始は日曜17:00 JST 境界（weekly_override.targetWeekStart と同じ形）', () => {
    const weeks = getProposableWeeks(jst(2026, 7, 22, 13));
    // 2026-07-26(日) 17:00 JST = 08:00 UTC
    expect(weeks[0].weekStart.toISOString()).toBe('2026-07-26T08:00:00.000Z');
    expect(weeks[0].weekEnd.getTime() - weeks[0].weekStart.getTime()).toBe(
      7 * 24 * 3600 * 1000,
    );
  });

  it('日曜16:59 JST はまだ今週なので、次週は同じ月曜のまま', () => {
    const before = getProposableWeeks(jst(2026, 7, 26, 16, 59));
    expect(before[0].mondayKey).toBe('2026-07-27');
  });

  it('日曜17:00 JST を過ぎると1週ぶん先へずれる', () => {
    const after = getProposableWeeks(jst(2026, 7, 26, 17, 0));
    expect(after[0].mondayKey).toBe('2026-08-03');
  });

  it('期間ラベルは月曜〜金曜', () => {
    const weeks = getProposableWeeks(jst(2026, 7, 22, 13));
    expect(weeks[0].periodLabel).toBe('7/27(月)〜7/31(金)');
  });

  it('選べる週の開始はすべて未来', () => {
    const now = jst(2026, 7, 22, 13);
    getProposableWeeks(now).forEach((w) => {
      expect(isTargetWeekUpcoming(w.weekStart, now)).toBe(true);
    });
  });
});

describe('resolveProposalStatus', () => {
  const ids = ['a', 'b', 'c'];
  const approve = (): ApprovalResponse => ({ decision: 'approved' });
  const reject = (): ApprovalResponse => ({ decision: 'rejected' });

  it('全員承認で approved', () => {
    expect(
      resolveProposalStatus(ids, { a: approve(), b: approve(), c: approve() }),
    ).toBe('approved');
  });

  it('1人でも否認すれば、残りが未回答でも rejected', () => {
    expect(resolveProposalStatus(ids, { a: approve(), b: reject() })).toBe(
      'rejected',
    );
  });

  it('未回答が残っていれば pending', () => {
    expect(resolveProposalStatus(ids, { a: approve(), b: approve() })).toBe(
      'pending',
    );
    expect(resolveProposalStatus(ids, {})).toBe('pending');
  });
});

describe('needsResponseFrom（ポップアップを出すか）', () => {
  const base = {
    status: 'pending' as const,
    approverIds: ['a', 'b', 'c'],
    responses: {} as Record<string, ApprovalResponse>,
    targetWeekStart: jst(2026, 8, 2, 17),
  };
  const now = jst(2026, 7, 29, 12);

  it('承認者で未回答なら聞く', () => {
    expect(needsResponseFrom(base, 'a', now)).toBe(true);
  });

  it('承認済み・否認済みなら二度と聞かない', () => {
    const answered = {
      ...base,
      responses: { a: { decision: 'approved' } as ApprovalResponse },
    };
    expect(needsResponseFrom(answered, 'a', now)).toBe(false);
    const rejected = {
      ...base,
      responses: { a: { decision: 'rejected' } as ApprovalResponse },
    };
    expect(needsResponseFrom(rejected, 'a', now)).toBe(false);
  });

  it('承認者でなければ聞かない', () => {
    expect(needsResponseFrom(base, 'z', now)).toBe(false);
  });

  it('決着済みの提案は聞かない', () => {
    expect(
      needsResponseFrom({ ...base, status: 'rejected' as const }, 'a', now),
    ).toBe(false);
  });

  it('対象週が始まっていたら、もう反映できないので聞かない', () => {
    expect(needsResponseFrom(base, 'a', jst(2026, 8, 3, 12))).toBe(false);
  });
});

describe('summarizeResponses', () => {
  it('承認/否認/未回答を数える', () => {
    const s = summarizeResponses(['a', 'b', 'c'], {
      a: { decision: 'approved' },
      b: { decision: 'rejected' },
    });
    expect(s).toEqual({ approved: 1, rejected: 1, pending: 1, total: 3 });
  });
});
