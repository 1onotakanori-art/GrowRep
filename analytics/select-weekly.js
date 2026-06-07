/**
 * 種目選出（ローカルPC・日曜17時運用）
 * --------------------------------------------------------------
 * app.js の selectWeeklyExercisesWithBarbarianSlot を Node 側に移植し、
 * 来週の週間チャレンジ3種目（通常2＋バーバリアン1）を加重ランダムで確定して
 * settings_free/weekly_override に書き込む。
 *
 * アプリは次回ロード時（日曜17時の週境界後）にこの override を採用し、
 * 前週の履歴保存・チャンプ集計を行ったうえで weekly_challenge を更新する
 * （＝選出をローカルに移しても、ロールオーバー処理はアプリ側の設計どおり安全に動く）。
 *
 * 重み = 1/(過去選出回数+1)^指数 × 種目評価補正 × 作成者評価補正
 *
 * 使い方:
 *   node select-weekly.js                    （来週ぶんを自動算出して確定）
 *   node select-weekly.js --label="特別回"    （ラベル付き）
 *   node select-weekly.js --target=2026-06-07 （対象週の起点 日曜の日付を明示）
 *   node select-weekly.js --dry-run           （書き込まず選出結果だけ表示）
 *
 * 運用タイミング: 日曜16:45〜16:55（週境界=日曜17:00 JST の直前）に実行する。
 *   17:00 を過ぎてから誰かがアプリを開くと override が採用され、来週の種目として反映される。
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = join(__dirname, 'serviceAccountKey.json');
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

// ---- 引数 ----------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);
const DRY_RUN = !!args['dry-run'];
const LABEL = typeof args.label === 'string' ? args.label : null;

// ---- 対象週の起点（日曜17:00 JST）を UTC Date で算出 ----------------------
// app.js getWeekBoundaries と同じ「日曜17:00 JST 起点」。選出は来週ぶんなので、
// 日曜に実行すれば「今日の17:00」、平日に前倒し実行すれば「次の日曜17:00」を対象にする。
function upcomingWeekStartUTC(now = new Date()) {
  if (typeof args.target === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.target)) {
    const [y, m, d] = args.target.split('-').map(Number);
    // 指定日（日曜想定）の 17:00 JST を UTC に
    const jst17 = Date.UTC(y, m - 1, d) + 17 * 60 * 60 * 1000;
    return new Date(jst17 - JST_OFFSET_MS);
  }
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const dow = jst.getUTCDay(); // 0=日
  const todayStartJst = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
  // 直近（=今週）の日曜 00:00 JST
  const thisSundayStartJst = todayStartJst - dow * DAY;
  let sunday17Jst = thisSundayStartJst + 17 * 60 * 60 * 1000;
  // 平日(月〜土)に前倒し実行する場合は「次の日曜17:00」を対象週とする
  if (dow !== 0) sunday17Jst += 7 * DAY;
  return new Date(sunday17Jst - JST_OFFSET_MS);
}

// ---- 選出ロジック（app.js から移植） --------------------------------------
function calcExerciseRatingModifier(summary) {
  if (!summary || (summary.ratingCount || 0) < 3) return 1.0;
  const avg = summary.avgRating;
  if (avg == null) return 1.0;
  if (avg <= 2) return 0.3;
  if (avg >= 4) return 2.0;
  if (avg < 3) return 0.3 + (avg - 2) * 0.7;
  return 1.0 + (avg - 3) * 1.0;
}

function calcCreatorRatingModifier(creatorData) {
  if (!creatorData) return 1.0;
  const count = creatorData.creatorRatedExerciseCount || 0;
  if (count < 3) return 1.0;
  const avg = creatorData.creatorAvgRating;
  if (avg == null) return 1.0;
  if (avg <= 2) return 0.6;
  if (avg >= 4) return 1.4;
  return 1.0;
}

function selectWeeklyExercises(allKeys, ctx, count, weightExponent) {
  const { exercises, history, exerciseRatings, creatorData } = ctx;
  if (allKeys.length <= count) return [...allKeys];
  const remaining = [...allKeys];
  const selected = [];
  for (let i = 0; i < count; i++) {
    const weights = remaining.map((key) => {
      const base = 1 / Math.pow((history[key] || 0) + 1, weightExponent);
      const exMod = calcExerciseRatingModifier(exerciseRatings[key] || null);
      const creatorId = exercises[key]?.createdBy || null;
      const crMod = calcCreatorRatingModifier(creatorId ? creatorData[creatorId] || null : null);
      return Math.max(base * exMod * crMod, 1e-9);
    });
    const total = weights.reduce((s, w) => s + w, 0);
    let rand = Math.random() * total;
    for (let j = 0; j < remaining.length; j++) {
      rand -= weights[j];
      if (rand <= 0) {
        selected.push(remaining[j]);
        remaining.splice(j, 1);
        break;
      }
    }
  }
  return selected;
}

function selectWithBarbarianSlot(ctx, weightExponent) {
  const { exercises } = ctx;
  const allKeys = Object.keys(exercises).filter((k) => !exercises[k]?.excludeFromWeekly);
  if (allKeys.length === 0) return [];
  const normalKeys = allKeys.filter((k) => !exercises[k]?.barbarian);
  const barbarianKeys = allKeys.filter((k) => exercises[k]?.barbarian);

  const selectedNormal = selectWeeklyExercises(normalKeys, ctx, 2, weightExponent);
  const selectedBarbarian = selectWeeklyExercises(barbarianKeys, ctx, 1, weightExponent);
  const set = new Set([...selectedNormal, ...selectedBarbarian]);
  if (set.size < 3) {
    const rest = allKeys.filter((k) => !set.has(k));
    selectWeeklyExercises(rest, ctx, 3 - set.size, weightExponent).forEach((k) => set.add(k));
  }
  return Array.from(set);
}

// ---- メイン --------------------------------------------------------------
async function main() {
  if (!existsSync(KEY_PATH)) {
    console.error(
      `\n[エラー] サービスアカウント鍵が見つかりません: ${KEY_PATH}\n` +
        `Firebase Console → プロジェクト設定 → サービスアカウント →「新しい秘密鍵の生成」で\n` +
        `JSON をダウンロードし、analytics/serviceAccountKey.json として保存してください。\n`
    );
    process.exit(1);
  }
  const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  // 必要データを取得
  const [exDoc, wcDoc, cfgDoc, ratingsSnap, usersSnap] = await Promise.all([
    db.collection('settings_free').doc('exercises').get(),
    db.collection('settings_free').doc('weekly_challenge').get(),
    db.collection('settings_free').doc('weekly_config').get(),
    db.collection('exercise_ratings').get(),
    db.collection('users').get(),
  ]);

  const exercises = (exDoc.exists && exDoc.data().exercises) || {};
  if (Object.keys(exercises).length === 0) {
    console.error('[選出] 種目が0件です。settings_free/exercises を確認してください。');
    process.exit(1);
  }
  const history = (wcDoc.exists && wcDoc.data().selectionHistory) || {};
  const weightExponent = (cfgDoc.exists && cfgDoc.data().weightExponent) || 2;

  const exerciseRatings = {};
  ratingsSnap.forEach((d) => {
    const v = d.data();
    exerciseRatings[d.id] = { avgRating: v.avgRating, ratingCount: v.ratingCount || 0 };
  });
  const creatorData = {};
  usersSnap.forEach((d) => {
    const v = d.data();
    creatorData[d.id] = {
      creatorAvgRating: v.creatorAvgRating,
      creatorRatedExerciseCount: v.creatorRatedExerciseCount || 0,
    };
  });

  const ctx = { exercises, history, exerciseRatings, creatorData };
  const selected = selectWithBarbarianSlot(ctx, weightExponent);
  const targetWeekStart = upcomingWeekStartUTC();

  const dn = ['日', '月', '火', '水', '木', '金', '土'];
  const tJst = new Date(targetWeekStart.getTime() + JST_OFFSET_MS);
  const monJst = new Date(tJst.getTime() + DAY);
  const friJst = new Date(tJst.getTime() + 5 * DAY);
  const fmt = (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${dn[d.getUTCDay()]})`;

  console.log('\n========================================');
  console.log('  来週の週間チャレンジ 種目選出');
  console.log('========================================');
  console.log(`対象週: ${fmt(monJst)}〜${fmt(friJst)}（起点 日曜17:00 JST = ${targetWeekStart.toISOString()}）`);
  console.log(`重み指数: ${weightExponent}\n`);
  selected.forEach((k, i) => {
    const e = exercises[k];
    const bar = e?.barbarian ? ' [バーバリアン]' : '';
    const r = exerciseRatings[k];
    const rated = r && r.ratingCount > 0 ? ` ★${(r.avgRating || 0).toFixed(1)}(${r.ratingCount})` : '';
    console.log(`  ${i + 1}. ${e?.name || k}${bar}${rated}  (選出回数 ${history[k] || 0})`);
  });
  console.log('');

  if (DRY_RUN) {
    console.log('[dry-run] 書き込みは行いませんでした。');
    process.exit(0);
  }

  await db.collection('settings_free').doc('weekly_override').set({
    exercises: selected,
    targetWeekStart: Timestamp.fromDate(targetWeekStart),
    label: LABEL,
    invalidated: false,
    generatedBy: 'select-weekly.js',
    generatedAt: FieldValue.serverTimestamp(),
  });

  console.log('[選出] weekly_override に書き込みました。');
  console.log('  → 日曜17:00 以降に誰かがアプリを開くと来週の種目として反映されます。');
  console.log('  → 続けて `npm run weekly`（export→digest）を実行すると、確定種目が digest の');
  console.log('     nextWeekConfirmed に入り、Cowork が「確定カード」として実況できます。\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('[選出] 失敗:', err);
  process.exit(1);
});
