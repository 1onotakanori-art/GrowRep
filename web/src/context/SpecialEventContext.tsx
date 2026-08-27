import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  loadMyProposals,
  loadProposalsForApprover,
} from '../lib/special-event-engine';
import {
  needsResponseFrom,
  needsResultNoticeFor,
  type SpecialEventProposal,
} from '../lib/special-event';

interface SpecialEventCtx {
  /** 自分がまだ承認/否認していない提案。ここが空になるまでポップアップが出続ける。 */
  pending: SpecialEventProposal[];
  /** 自分が承認者になっている提案（回答済みも含む） */
  inbox: SpecialEventProposal[];
  /** 自分が出した提案 */
  mine: SpecialEventProposal[];
  /**
   * 自分の提案のうち、3人ぶんの回答が揃って結果が確定し、
   * まだ本人が結果ポップアップを見ていないもの。
   */
  results: SpecialEventProposal[];
  loading: boolean;
  reload: () => Promise<void>;
}

const Ctx = createContext<SpecialEventCtx | null>(null);

export function SpecialEventProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [pending, setPending] = useState<SpecialEventProposal[]>([]);
  const [inbox, setInbox] = useState<SpecialEventProposal[]>([]);
  const [mine, setMine] = useState<SpecialEventProposal[]>([]);
  const [results, setResults] = useState<SpecialEventProposal[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setPending([]);
      setInbox([]);
      setMine([]);
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [inboxList, mineList] = await Promise.all([
        loadProposalsForApprover(user.uid),
        loadMyProposals(user.uid),
      ]);
      setInbox(inboxList);
      setMine(mineList);
      setResults(
        mineList
          .filter((p) => needsResultNoticeFor(p, user.uid))
          .sort(
            (a, b) => a.targetWeekStart.getTime() - b.targetWeekStart.getTime(),
          ),
      );
      setPending(
        inboxList
          .filter((p) => needsResponseFrom(p, user.uid))
          .sort(
            (a, b) => a.targetWeekStart.getTime() - b.targetWeekStart.getTime(),
          ),
      );
    } catch (e) {
      // 提案機能が落ちても本体は動かす
      console.warn('[特別イベント] 提案の取得に失敗:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <Ctx.Provider value={{ pending, inbox, mine, results, loading, reload }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSpecialEvent(): SpecialEventCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useSpecialEvent must be used within SpecialEventProvider');
  }
  return ctx;
}
