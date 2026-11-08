import { createContext, useContext } from 'react';

/**
 * 種目の詳細（種目タブの該当カード）へ移動する関数。AppShell が用意する。
 * フリーモードは「種目」タブ、それ以外のモードは種目一覧のサブページを開く。
 */
const ExerciseNavContext = createContext<((exerciseKey: string) => void) | null>(null);

export const ExerciseNavProvider = ExerciseNavContext.Provider;

/** Provider の外（テストなど）では null。ボタンを出さない判定に使う */
export function useOpenExercise() {
  return useContext(ExerciseNavContext);
}
