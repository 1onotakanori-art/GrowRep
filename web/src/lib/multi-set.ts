// デイリーの「複数セットまとめて入力」の純粋ロジック。
// 入力された回数はセットごとに普通の投稿として1件ずつ保存する（まとまりの情報は持たない）。
// そのため集計側（当日合計・ベスト・ピーク）は何も変わらない。

/** 一度に入れられるセット数の上限 */
export const MULTI_SET_MAX = 10;
/** 1セットあたりの回数の上限（単発投稿と同じ） */
export const MULTI_SET_VALUE_MAX = 10000;
/** 分け方の候補で、1セットがこれ未満になるものは出さない */
export const MULTI_SET_MIN_PER = 5;
/** 候補に出すセット数の範囲 */
export const MULTI_SET_SPLIT_MIN = 2;
export const MULTI_SET_SPLIT_MAX = 5;

/** 分け方の候補1つ（例: 3×14） */
export interface SetSplit {
  id: string;
  label: string;
  values: number[];
}

function makeSplit(sets: number, per: number): SetSplit {
  return {
    id: `${sets}x${per}`,
    label: `${sets}×${per}`,
    values: Array.from({ length: sets }, () => per),
  };
}

/**
 * 残り回数から分け方の候補を作る。1セット = ⌈残り ÷ セット数⌉。
 * 1セットが MULTI_SET_MIN_PER 未満になる候補は捨てる。
 * 1つも残らないほど残りが少ない時は「1×残り」だけを返す。残りが0以下なら空。
 */
export function suggestSetSplits(remaining: number): SetSplit[] {
  const r = Math.floor(remaining);
  if (!(r > 0)) return [];
  const out: SetSplit[] = [];
  for (let n = MULTI_SET_SPLIT_MIN; n <= MULTI_SET_SPLIT_MAX; n++) {
    const per = Math.ceil(r / n);
    if (per < MULTI_SET_MIN_PER) break;
    out.push(makeSplit(n, per));
  }
  return out.length > 0 ? out : [makeSplit(1, r)];
}

/** レイドの日の候補（個人目標が無く、残りはみんなの合計で大きすぎるので固定） */
export const RAID_SET_SPLITS: SetSplit[] = [
  makeSplit(3, 10),
  makeSplit(3, 15),
  makeSplit(3, 20),
];

/**
 * 入力欄の文字列を投稿する回数の配列にする。空欄と0は捨てる。
 * 整数でない・負・上限超えが1つでもあれば error を返す。
 */
export function collectSetValues(
  raw: string[],
): { values: number[]; error: string | null } {
  const values: number[] = [];
  for (const s of raw) {
    const t = s.trim();
    if (t === '') continue;
    if (!/^\d+$/.test(t)) return { values: [], error: 'invalid' };
    const n = parseInt(t, 10);
    if (n === 0) continue;
    if (n > MULTI_SET_VALUE_MAX) return { values: [], error: 'invalid' };
    values.push(n);
  }
  if (values.length === 0) return { values, error: 'empty' };
  if (values.length > MULTI_SET_MAX) return { values: [], error: 'too-many' };
  return { values, error: null };
}

/** 数の配列の合計 */
export function sumSetValues(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}
