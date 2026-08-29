// =====================================================================
// JST タイミングロジック
// ⚠️ 既存 app.js の同名関数の「ミラー」。両アプリが同じ Firestore の
//    週データを読み書きするため、計算式・定数・分岐を変更しないこと。
//    app.js 側を変更した場合はこのファイルも必ず同じに更新する。
// =====================================================================

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 今週の境界を返す。週は「日曜 17:00 JST」起点。
 * app.js: getWeekBoundaries
 */
export function getWeekBoundaries(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const jstMs = now.getTime() + JST_OFFSET_MS;
  const jstDate = new Date(jstMs);

  const jstDayOfWeek = jstDate.getUTCDay(); // 0=日, 1=月, ..., 6=土
  const jstHour = jstDate.getUTCHours();
  const jstMin = jstDate.getUTCMinutes();
  const jstSec = jstDate.getUTCSeconds();
  const jstMs2 = jstDate.getUTCMilliseconds();

  const todayJstDayStartMs =
    jstMs - (jstHour * 3600 + jstMin * 60 + jstSec) * 1000 - jstMs2;

  let daysBack: number;
  if (jstDayOfWeek === 0 && jstHour < 17) {
    daysBack = 7;
  } else {
    daysBack = jstDayOfWeek;
  }

  const lastSundayJstDayStartMs =
    todayJstDayStartMs - daysBack * 24 * 60 * 60 * 1000;
  const weekStartJstMs = lastSundayJstDayStartMs + 17 * 60 * 60 * 1000;

  const weekStartUTC = new Date(weekStartJstMs - JST_OFFSET_MS);
  const weekEndUTC = new Date(weekStartUTC.getTime() + 7 * 24 * 60 * 60 * 1000);

  return { start: weekStartUTC, end: weekEndUTC };
}

/** JST 換算で平日（月〜金）か。app.js: isWeekdayJST */
export function isWeekdayJST(date: Date): boolean {
  const jstDate = new Date(date.getTime() + JST_OFFSET_MS);
  const jstDayOfWeek = jstDate.getUTCDay();
  return jstDayOfWeek >= 1 && jstDayOfWeek <= 5;
}

// 4種目目（？？？枠）の解禁: 水曜 13:00 JST
export const REVEAL_DOW_JST = 3;
export const REVEAL_HOUR_JST = 13;

/** 4種目目の解禁時刻に達しているか。app.js: isRevealUnlockedJST */
export function isRevealUnlockedJST(date: Date = new Date()): boolean {
  const jstDate = new Date(date.getTime() + JST_OFFSET_MS);
  const dow = jstDate.getUTCDay();
  const hour = jstDate.getUTCHours();
  if (dow === 0) return hour < 17;
  if (dow < REVEAL_DOW_JST) return false;
  if (dow === REVEAL_DOW_JST) return hour >= REVEAL_HOUR_JST;
  return true;
}

/**
 * 今アクティブな種目キーを返す。3種目以下は全件、4種目以上は
 * 先頭3種目 + 水曜13:00解禁後に末尾を追加。app.js: getActiveWeeklyKeys
 *
 * revealAll = true の週は水曜解禁をせず最初から全種目を返す。
 * 特別イベント週（承認された提案の種目をそのまま出す週）がこれで、
 * 承認者には4種目すべてを見せて承認させているので伏せる意味がない。
 */
export function getActiveWeeklyKeys(
  exercises: string[] | undefined,
  now: Date = new Date(),
  revealAll: boolean = false,
): string[] {
  const list = Array.isArray(exercises) ? exercises : [];
  if (list.length <= 3 || revealAll) return list;
  return isRevealUnlockedJST(now) ? list : list.slice(0, 3);
}

/**
 * 週間チャレンジのアクティブ種目キー。特別イベント週（isManualOverride）は
 * 水曜解禁を適用しない。app.js: getActiveWeeklyKeysForCurrentWeek
 */
export function activeWeeklyKeysOf(
  challenge: {
    exercises?: string[];
    isManualOverride?: boolean;
  } | null,
  now: Date = new Date(),
): string[] {
  if (!challenge) return [];
  return getActiveWeeklyKeys(challenge.exercises, now, !!challenge.isManualOverride);
}

/** 予想受付中か（日曜17:00〜火曜24:00 JST）。app.js: isPredictionOpenJST */
export function isPredictionOpenJST(now: Date = new Date()): boolean {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const dow = jst.getUTCDay();
  const hour = jst.getUTCHours();
  if (dow === 0) return hour >= 17;
  return dow === 1 || dow === 2;
}

/** JST 平日インデックス（月=0..金=4、土日=-1）。app.js: weekdayIndexJST */
export function weekdayIndexJST(date: Date): number {
  const dow = new Date(date.getTime() + JST_OFFSET_MS).getUTCDay();
  return dow >= 1 && dow <= 5 ? dow - 1 : -1;
}

/** 年内週番号。app.js: getWeekNumberOfYear */
export function getWeekNumberOfYear(date: Date): number {
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const diffMs = date.getTime() - yearStart.getTime();
  return Math.ceil((diffMs / (24 * 60 * 60 * 1000) + 1) / 7);
}

/**
 * 週開始日時から歴代チャンプ docId とメタ情報を作成。
 * app.js: buildChampionDocMeta
 */
export function buildChampionDocMeta(weekStart: Date): {
  docId: string;
  year: number;
  weekNumber: number;
  monJST: Date;
  friJST: Date;
} {
  const monJST = new Date(
    weekStart.getTime() + JST_OFFSET_MS + 1 * 24 * 60 * 60 * 1000,
  );
  const friJST = new Date(
    weekStart.getTime() + JST_OFFSET_MS + 5 * 24 * 60 * 60 * 1000,
  );
  const weekNumber = getWeekNumberOfYear(monJST);
  const year = monJST.getUTCFullYear();
  const docId = `${year}_W${String(weekNumber).padStart(2, '0')}`;
  return { docId, year, weekNumber, monJST, friJST };
}

/** 週間表示ラベル（例: 7/21(月)〜7/25(金)）。app.js: formatWeeklyPeriodLabel */
export function formatWeeklyPeriodLabel(monJST: Date, friJST: Date): string {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const fmt = (d: Date) =>
    `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${dayNames[d.getUTCDay()]})`;
  return `${fmt(monJST)}〜${fmt(friJST)}`;
}
