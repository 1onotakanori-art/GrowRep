/**
 * ① Firestore エクスポート
 * --------------------------------------------------------------
 * firebase-admin で GrowRep の Firestore を全件取得し、
 * AI / 集計スクリプトが読みやすい正規化済み dataset.json を
 * exports/YYYY-MM-DD/ に出力する。
 *
 * 使い方:
 *   1) Firebase Console → プロジェクト設定 → サービスアカウント →
 *      「新しい秘密鍵の生成」で JSON をダウンロードし、
 *      この analytics/ フォルダに serviceAccountKey.json として置く
 *   2) npm install
 *   3) npm run export            （今日の日付で出力）
 *      npm run export -- --date=2026-06-06   （日付指定）
 *
 * 認証ルールは admin SDK では無視されるため、ログイン不要で全件取得できる。
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = join(__dirname, 'serviceAccountKey.json');

// ---- 引数 ----------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);
const dateStr = typeof args.date === 'string' ? args.date : localDateString();

function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---- 初期化 --------------------------------------------------------------
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
const PROJECT_ID = serviceAccount.project_id || 'unknown';

// ---- Timestamp などを JSON 安全な値へ再帰変換 ----------------------------
function serialize(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  // admin SDK の GeoPoint / DocumentReference などは toJSON で潰す
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString();
    } catch {
      /* fall through */
    }
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out;
  }
  return value;
}

async function dumpCollection(name) {
  const snap = await db.collection(name).get();
  return snap.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));
}

async function dumpDoc(collection, docId) {
  const doc = await db.collection(collection).doc(docId).get();
  return doc.exists ? serialize(doc.data()) : null;
}

// ---- メイン --------------------------------------------------------------
async function main() {
  console.log(`[export] プロジェクト: ${PROJECT_ID} / 出力日付: ${dateStr}`);

  // 主要コレクション（フリーモードが現行のメイン）
  const [
    usersRaw,
    postsFreeRaw,
    postsRaw,
    postsIntervalRaw,
    ratingsRaw,
    weeklyChampions,
    weeklyHistory,
  ] = await Promise.all([
    dumpCollection('users'),
    dumpCollection('posts_free'),
    dumpCollection('posts'),
    dumpCollection('posts_interval'),
    dumpCollection('exercise_ratings'),
    dumpCollection('weekly_champions'),
    dumpCollection('weekly_challenge_history'),
  ]);

  // settings_free 配下の主要ドキュメント
  const [exercisesDoc, weeklyChallenge, weeklyConfig, weeklyOverride] = await Promise.all([
    dumpDoc('settings_free', 'exercises'),
    dumpDoc('settings_free', 'weekly_challenge'),
    dumpDoc('settings_free', 'weekly_config'),
    dumpDoc('settings_free', 'weekly_override'),
  ]);

  // 各種目評価のユーザー別内訳（user_ratings サブコレクション）
  const ratingDetail = {};
  for (const r of ratingsRaw) {
    const sub = await db
      .collection('exercise_ratings')
      .doc(r.id)
      .collection('user_ratings')
      .get();
    ratingDetail[r.id] = sub.docs.map((d) => ({ uid: d.id, ...serialize(d.data()) }));
  }

  // ---- 正規化 -------------------------------------------------------------
  const users = usersRaw.map((u) => ({
    uid: u.id,
    userName: u.userName || u.email || u.id,
    email: u.email || null,
    isGuest: !!u.isGuest,
    createdAt: u.createdAt || null,
    creatorAvgRating: typeof u.creatorAvgRating === 'number' ? u.creatorAvgRating : null,
    creatorRatedExerciseCount: u.creatorRatedExerciseCount || 0,
  }));

  const ratingByKey = {};
  for (const r of ratingsRaw) {
    ratingByKey[r.id] = {
      avg: typeof r.avgRating === 'number' ? r.avgRating : null,
      count: r.ratingCount || 0,
      sum: r.ratingSum || 0,
    };
  }

  const exMap = exercisesDoc && exercisesDoc.exercises ? exercisesDoc.exercises : {};
  const exercises = Object.entries(exMap).map(([key, ex]) => ({
    key,
    name: ex.name || key,
    rule: ex.rule || '', // = 説明 / ルール
    tags: Array.isArray(ex.tags) ? ex.tags : [],
    icon: ex.icon || 'fa-dumbbell',
    barbarian: !!ex.barbarian,
    excludeFromWeekly: !!ex.excludeFromWeekly,
    createdBy: ex.createdBy || null,
    createdByName: ex.createdByName || null,
    createdAt: ex.createdAt || null,
    rating: ratingByKey[key] || { avg: null, count: 0, sum: 0 },
  }));

  // posts_free の正規化（メール等の個人情報は uid のみに落とす）
  const posts = postsFreeRaw.map((p) => ({
    id: p.id,
    uid: p.userId || null,
    exerciseKey: p.exerciseType || null,
    value: typeof p.value === 'number' ? p.value : Number(p.value) || 0,
    timestamp: p.timestamp || null,
    likes: Array.isArray(p.likes) ? p.likes : [],
    comments: Array.isArray(p.comments)
      ? p.comments.map((c) => ({
          uid: c.userId || null,
          text: c.text || '',
          timestamp: c.timestamp || null,
        }))
      : [],
  }));

  const dataset = {
    meta: {
      exportedAt: new Date().toISOString(),
      exportDate: dateStr,
      projectId: PROJECT_ID,
      mode: 'free',
      counts: {
        users: users.length,
        exercises: exercises.length,
        posts_free: posts.length,
        posts_legacy: postsRaw.length,
        posts_interval: postsIntervalRaw.length,
      },
    },
    users,
    exercises,
    posts,
    ratingDetail,
    weeklyChallenge,
    weeklyConfig,
    weeklyOverride,
    weeklyChampions,
    weeklyHistory,
    // 旧モードは分析対象外だが将来用に生で保持
    legacy: {
      posts: postsRaw,
      posts_interval: postsIntervalRaw,
    },
  };

  const outDir = join(__dirname, 'exports', dateStr);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'dataset.json');
  writeFileSync(outPath, JSON.stringify(dataset, null, 2), 'utf8');

  console.log(
    `[export] 完了: ${outPath}\n` +
      `  users=${users.length}, exercises=${exercises.length}, posts_free=${posts.length}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[export] 失敗:', err);
    process.exit(1);
  });
