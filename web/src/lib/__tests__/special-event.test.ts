import { describe, it, expect } from 'vitest';
import {
  getProposableWeeks,
  resolveProposalStatus,
  needsResponseFrom,
  isTargetWeekUpcoming,
  summarizeResponses,
  buildApproverCandidates,
  countRecentPosts,
  getApproverActiveSince,
  SPECIAL_EVENT_ACTIVE_DAYS,
  SPECIAL_EVENT_WEEK_CHOICES,
  type ApprovalResponse,
  type CandidatePost,
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

describe('承認者候補（過去5日以内に投稿した人）', () => {
  const now = jst(2026, 7, 29, 12);
  const post = (
    userId: string,
    postedAt: Date | null,
    value: number = 10,
  ): CandidatePost => ({ userId, value, postedAt });

  it('境界はちょうど5日前', () => {
    const since = getApproverActiveSince(now);
    expect(SPECIAL_EVENT_ACTIVE_DAYS).toBe(5);
    expect(since.toISOString()).toBe(jst(2026, 7, 24, 12).toISOString());
  });

  it('5日以内の投稿だけを数える（種目・曜日は問わない）', () => {
    const since = getApproverActiveSince(now);
    const counts = countRecentPosts(
      [
        post('a', jst(2026, 7, 29, 9)), // 当日
        post('a', jst(2026, 7, 26, 9)), // 日曜（週末でも数える）
        post('b', jst(2026, 7, 24, 12)), // ちょうど境界 = 含む
        post('c', jst(2026, 7, 24, 11, 59)), // 5日より前 = 除外
      ],
      since,
    );
    expect(counts).toEqual({ a: 2, b: 1 });
  });

  it('タイムスタンプ無し・値0の投稿は数えない', () => {
    const since = getApproverActiveSince(now);
    const counts = countRecentPosts(
      [post('a', null), post('b', jst(2026, 7, 28, 9), 0)],
      since,
    );
    expect(counts).toEqual({});
  });

  it('1回でも投稿していれば候補になる', () => {
    const list = buildApproverCandidates({ a: 1 }, { a: { userName: 'A' } }, 'me');
    expect(list).toEqual([{ userId: 'a', userName: 'A', postCount: 1 }]);
  });

  it('自分とゲストは候補から外し、投稿数の多い順に並べる', () => {
    const list = buildApproverCandidates(
      { me: 9, guest: 5, a: 1, b: 3 },
      {
        me: { userName: '自分' },
        guest: { userName: 'ゲスト', isGuest: true },
        a: { userName: 'あ' },
        b: { userName: 'い' },
      },
      'me',
    );
    expect(list.map((c) => c.userId)).toEqual(['b', 'a']);
  });

  it('users に名前が無ければ「名無しさん」', () => {
    const list = buildApproverCandidates({ x: 2 }, {}, 'me');
    expect(list[0].userName).toBe('名無しさん');
  });
});
