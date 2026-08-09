import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Mode } from '../lib/types';

interface ModeCtx {
  mode: Mode;
  setMode: (m: Mode) => void;
  /** データ再取得を促すためのトークン。更新ボタン等でインクリメントする。 */
  refreshToken: number;
  refresh: () => void;
}

const Ctx = createContext<ModeCtx | null>(null);
const STORAGE_KEY = 'growrep_mode';

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'weekly' || saved === 'raid') return saved;
    return 'free';
  });
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const setMode = useCallback((m: Mode) => setModeState(m), []);
  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  return (
    <Ctx.Provider value={{ mode, setMode, refreshToken, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMode(): ModeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMode must be used within ModeProvider');
  return ctx;
}
