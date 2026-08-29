import { describe, it, expect } from 'vitest';
import {
  canWithdrawProposal,
  getProposableWeeks,
  listDecisions,
  listRejections,
  needsResultNoticeFor,
  normalizeDecisionComment,
  resolveProposalStatus,
  needsResponseFrom,
  isTargetWeekUpcoming,
  summarizeResponses,
  buildApproverCandidates,
  countRecentPosts,
  getApproverActiveSince,
  validateDecisionComment,
  validateProposalInput,
  SPECIAL_EVENT_ACTIVE_DAYS,
  SPECIAL_EVENT_COMMENT_MAX,
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

  it('全員が回答して1人でも否認していれば rejected', () => {
    expect(
      resolveProposalStatus(ids, { a: approve(), b: reject(), c: approve() }),
    ).toBe('rejected');
    expect(
      resolveProposalStatus(ids, { a: reject(), b: reject(), c: reject() }),
    ).toBe('rejected');
  });

  it('否認が出ても、3人ぶん揃うまでは pending のまま（全員の意見を集める）', () => {
    expect(resolveProposalStatus(ids, { a: approve(), b: reject() })).toBe(
      'pending',
    );
  });

  it('未回答が残っていれば pending', () => {
    expect(resolveProposalStatus(ids, { a: approve(), b: approve() })).toBe(
      'pending',
    );
    expect(resolveProposalStatus(ids, {})).toBe('pending');
  });
});

describe('needsResponseFrom（他の人が先に否認していても最後まで聞く）', () => {
  it('誰かが否認済みでも status が pending なら自分には聞く', () => {
    const p = {
      status: 'pending' as const,
      approverIds: ['a', 'b', 'c'],
      responses: { b: { decision: 'rejected' } as ApprovalResponse },
      targetWeekStart: jst(2026, 8, 2, 17),
    };
    expect(needsResponseFrom(p, 'a', jst(2026, 7, 29, 12))).toBe(true);
  });
});

describe('validateDecisionComment（否認理由は必須）', () => {
  it('承認ならコメントは不要', () => {
    expect(validateDecisionComment('approved', '')).toBeNull();
  });

  it('否認で空・空白だけならエラー', () => {
    expect(validateDecisionComment('rejected', '')).toBe(
      '否認する場合は理由を入力してください',
    );
    expect(validateDecisionComment('rejected', '  \n ')).toBe(
      '否認する場合は理由を入力してください',
    );
  });

  it('否認で一言あればOK', () => {
    expect(validateDecisionComment('rejected', 'この週は厳しいです')).toBeNull();
  });

  it('長すぎるコメントはエラー', () => {
    const tooLong = 'あ'.repeat(SPECIAL_EVENT_COMMENT_MAX + 1);
    expect(validateDecisionComment('rejected', tooLong)).toBe(
      `理由は${SPECIAL_EVENT_COMMENT_MAX}文字以内で入力してください`,
    );
  });
});

describe('normalizeDecisionComment（保存する形）', () => {
  it('承認時は空文字（undefined を Firestore に渡さない）', () => {
    expect(normalizeDecisionComment('approved', 'なにか')).toBe('');
  });

  it('否認時は前後の空白を落として保存する', () => {
    expect(normalizeDecisionComment('rejected', '  きつい  ')).toBe('きつい');
  });

  it('上限を超えたぶんは切り詰める', () => {
    const long = 'あ'.repeat(SPECIAL_EVENT_COMMENT_MAX + 50);
    expect(normalizeDecisionComment('rejected', long)).toHaveLength(
      SPECIAL_EVENT_COMMENT_MAX,
    );
  });
});

describe('提案者への結果通知', () => {
  const base = {
    proposerId: 'me',
    approverIds: ['a', 'b', 'c'],
    approverNames: { a: 'あー', b: 'びー', c: 'しー' },
    responses: {
      a: { decision: 'approved' } as ApprovalResponse,
      b: { decision: 'rejected', comment: '種目が偏っている' } as ApprovalResponse,
      c: { decision: 'rejected', comment: '' } as ApprovalResponse,
    },
  };

  it('回答が揃うまでは出さない', () => {
    expect(
      needsResultNoticeFor(
        { proposerId: 'me', status: 'pending', resultSeenAt: null },
        'me',
      ),
    ).toBe(false);
  });

  it('確定していて未確認なら出す', () => {
    expect(
      needsResultNoticeFor(
        { proposerId: 'me', status: 'rejected', resultSeenAt: null },
        'me',
      ),
    ).toBe(true);
    expect(
      needsResultNoticeFor(
        { proposerId: 'me', status: 'approved', resultSeenAt: null },
        'me',
      ),
    ).toBe(true);
  });

  it('確認済みなら二度と出さない', () => {
    expect(
      needsResultNoticeFor(
        { proposerId: 'me', status: 'rejected', resultSeenAt: new Date() },
        'me',
      ),
    ).toBe(false);
  });

  it('提案者本人以外には出さない', () => {
    expect(
      needsResultNoticeFor(
        { proposerId: 'me', status: 'rejected', resultSeenAt: null },
        'other',
      ),
    ).toBe(false);
  });

  it('自分で取り下げた提案には結果ポップアップを出さない', () => {
    expect(
      needsResultNoticeFor(
        { proposerId: 'me', status: 'withdrawn', resultSeenAt: null },
        'me',
      ),
    ).toBe(false);
  });

  it('listDecisions は承認者順に回答を並べる', () => {
    expect(listDecisions(base)).toEqual([
      { userId: 'a', userName: 'あー', decision: 'approved', comment: '' },
      {
        userId: 'b',
        userName: 'びー',
        decision: 'rejected',
        comment: '種目が偏っている',
      },
      { userId: 'c', userName: 'しー', decision: 'rejected', comment: '' },
    ]);
  });

  it('未回答の承認者は decision=null で並ぶ', () => {
    const partial = { ...base, responses: { a: base.responses.a } };
    expect(listDecisions(partial).map((d) => d.decision)).toEqual([
      'approved',
      null,
      null,
    ]);
  });

  it('listRejections は否認した人のコメントだけを返す', () => {
    expect(listRejections(base).map((d) => d.userName)).toEqual(['びー', 'しー']);
    expect(listRejections(base)[0].comment).toBe('種目が偏っている');
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

describe('canWithdrawProposal（提案の取り下げ）', () => {
  it('自分の回答待ちの提案は取り下げられる', () => {
    expect(canWithdrawProposal({ proposerId: 'me', status: 'pending' }, 'me')).toBe(
      true,
    );
  });

  it('他人の提案は取り下げられない', () => {
    expect(
      canWithdrawProposal({ proposerId: 'other', status: 'pending' }, 'me'),
    ).toBe(false);
  });

  it('確定済み（承認/否認）の提案は取り下げられない', () => {
    // 承認済みは weekly_override へ反映済みかもしれないので触らせない
    expect(
      canWithdrawProposal({ proposerId: 'me', status: 'approved' }, 'me'),
    ).toBe(false);
    expect(
      canWithdrawProposal({ proposerId: 'me', status: 'rejected' }, 'me'),
    ).toBe(false);
  });

  it('取り下げ済みの提案をもう一度は取り下げられない', () => {
    expect(
      canWithdrawProposal({ proposerId: 'me', status: 'withdrawn' }, 'me'),
    ).toBe(false);
  });

  it('未ログイン（userId 空）では取り下げられない', () => {
    expect(canWithdrawProposal({ proposerId: 'me', status: 'pending' }, '')).toBe(
      false,
    );
  });
});

describe('取り下げた提案は承認者に聞かない', () => {
  it('status=withdrawn なら needsResponseFrom は false', () => {
    expect(
      needsResponseFrom(
        {
          status: 'withdrawn',
          approverIds: ['a', 'b', 'c'],
          responses: {},
          targetWeekStart: jst(2026, 8, 2, 17),
        },
        'a',
        jst(2026, 7, 28, 12),
      ),
    ).toBe(false);
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

describe('validateProposalInput（特別イベントに種目の組み合わせ制限は無い）', () => {
  const weekStart = jst(2026, 9, 7);
  const approvers = ['a', 'b', 'c'];

  it('4種目・開始日・承認者3人が揃っていれば通る', () => {
    expect(
      validateProposalInput({
        exercises: ['pushup', 'dips', 'squat', 'pullup'],
        weekStart,
        approverIds: approvers,
      }),
    ).toBeNull();
  });

  it('タイムアタック種目だけを4つ選んでも通る（週間チャレンジの自動選出と違い1種目までの制限は無い）', () => {
    expect(
      validateProposalInput({
        exercises: ['ta1', 'ta2', 'ta3', 'ta4'],
        weekStart,
        approverIds: approvers,
      }),
    ).toBeNull();
  });

  it('種目数が足りなければ弾く', () => {
    expect(
      validateProposalInput({
        exercises: ['pushup', 'dips'],
        weekStart,
        approverIds: approvers,
      }),
    ).toBe('種目を4種類選んでください');
  });

  it('同じ種目の重複は弾く', () => {
    expect(
      validateProposalInput({
        exercises: ['pushup', 'pushup', 'dips', 'squat'],
        weekStart,
        approverIds: approvers,
      }),
    ).toBe('同じ種目は選べません');
  });

  it('承認者が3人でなければ弾く', () => {
    expect(
      validateProposalInput({
        exercises: ['pushup', 'dips', 'squat', 'pullup'],
        weekStart,
        approverIds: ['a', 'b'],
      }),
    ).toBe('承認者を3人選んでください');
  });
});
