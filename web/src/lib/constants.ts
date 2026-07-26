// モード共通の定数（既存 app.js より移植）
import type { FreeExercise } from './types';

// free / weekly はどちらも *_free コレクションを共用する
export function collectionName(base: string): string {
  return `${base}_free`;
}

// 標準5種目（フリーモードで種目未登録時のフォールバックとして使用）
export const STANDARD_EXERCISES: Record<string, FreeExercise> = {
  pushup: {
    name: 'プッシュアップ',
    rule: 'プッシュアップバーを使用。顎がマットにつくまで下げる。',
    icon: 'fa-dumbbell',
    tags: [],
  },
  dips: {
    name: 'ディップス',
    rule: '顎がストレッチポールにタッチするまで下げる。幅、ポール位置は自由。',
    icon: 'fa-fire',
    tags: [],
  },
  squat: {
    name: '片足スクワット',
    rule: 'マット3段重ねの上で、片足でしゃがんで立ち上がる。左右の合計回数。',
    icon: 'fa-shoe-prints',
    tags: [],
  },
  Lsit: {
    name: 'Lシット(秒)',
    rule: 'プッシュアップバーを使って、足を水平に持ち上げてキープする秒数。',
    icon: 'fa-chair',
    tags: [],
  },
  pullup: {
    name: '懸垂(セット)',
    rule: '順手か逆手で行う。1セットの回数は任意。',
    icon: 'fa-person-falling',
    tags: [],
  },
};

// 種目追加/編集モーダルで選べるアイコン候補（既存 app.js の renderIconGrid より）
export const ICON_CHOICES: string[] = [
  'fa-dumbbell',
  'fa-fire',
  'fa-bolt',
  'fa-heart-pulse',
  'fa-person-running',
  'fa-person-falling-burst',
  'fa-person-arrow-up-from-line',
  'fa-person-arrow-down-to-line',
  'fa-person-shelter',
  'fa-hand-fist',
  'fa-hand-holding',
  'fa-shoe-prints',
  'fa-weight-hanging',
  'fa-stopwatch',
  'fa-rocket',
  'fa-bicycle',
  'fa-water',
  'fa-crosshairs',
  'fa-bolt',
  'fa-circle',
  'fa-square',
];

// キャッシュ有効期間: 5分（既存と同一）
export const CACHE_DURATION = 5 * 60 * 1000;
export const POSTS_PAGE_SIZE = 50;
export const RANKING_TIE_EPSILON = 1e-6;

// タグのプリセット候補（既存 app.js の PRESET_TAGS と同一）
export const PRESET_TAGS = [
  '胸', '背中', '肩', '腕', '脚', '腹', '全身', '体幹',
  '自重', 'ウェイト', '3秒1回', '1分間',
];
