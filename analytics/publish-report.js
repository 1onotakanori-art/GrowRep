/**
 * ④→⑤ ウィークリー配信（publish）
 * --------------------------------------------------------------
 * Cowork が生成した report_<exportDate>.md と digest.json を読み込み、
 *   - 週報 Markdown を HTML 化（marked）
 *   - 分析ダッシュボード用に digest 全量
 *   - 来週の確定種目（あれば）
 * を Firestore の weekly_reports/<exportDate> に publish する。
 *
 * クライアント（report.html）はこのドキュメントを auth 越しに読み、
 * 週報＋ダッシュボードを表示する。書き込みはサービスアカウント（admin SDK）のみ
 * なので、配信内容は改ざん不能な「公式発表」になる。
 *
 * 使い方:
 *   node publish-report.js                      （exports 内の最新日付を publish）
 *   node publish-report.js --date=2026-06-07     （日付指定）
 *
 * 前提: 先に `npm run weekly`（export→digest）と Cowork での週報生成を済ませること。
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = join(__dirname, 'serviceAccountKey.json');
const EXPORTS_DIR = join(__dirname, 'exports');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);

function latestDateDir() {
  if (!existsSync(EXPORTS_DIR)) return null;
  const dirs = readdirSync(EXPORTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
    .map((d) => d.name)
    .sort();
  return dirs.length ? dirs[dirs.length - 1] : null;
}

// marked 出力から script タグ等を除去（作成者は信頼できるが二重の保険）
function sanitizeHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/ on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/ on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

/**
 * 週報 Markdown から「メンバー寸評（ひとことMC）」セクションを抜き出す。
 * --------------------------------------------------------------
 * テンプレートの `## 👤 メンバー寸評` セクションは `- 名前: 寸評` の1行1人形式。
 * これを { userName: 寸評 } に変換し、report.js がユーザー別カルテの各カードへ差し込む。
 * 同セクションは本文（reportHtml）からは取り除き、カルテと二重表示にならないようにする。
 * 旧フォーマット（セクション無し）の場合は notes={} を返し、本文はそのまま。
 */
function extractMemberNotes(md) {
  const lines = md.split(/\r?\n/);
  const notes = {};
  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (start === -1) {
      if (/^#{1,6}\s+.*メンバー寸評/.test(lines[i])) start = i;
      continue;
    }
    if (/^#{1,6}\s+/.test(lines[i])) {
      end = i;
      break;
    }
    // `- **名前**: 寸評` / `- 名前: 寸評`（全角コロンも許容）
    const m = lines[i].match(/^\s*[-*]\s+(?:\*\*)?([^:：*]+?)(?:\*\*)?\s*[:：]\s*(.+?)\s*$/);
    if (m) notes[m[1].trim()] = m[2].trim();
  }
  if (start === -1) return { notes: {}, mdStripped: md };
  const mdStripped = [...lines.slice(0, start), ...lines.slice(end)].join('\n');
  return { notes, mdStripped };
}

async function main() {
  const dateStr = typeof args.date === 'string' ? args.date : latestDateDir();
  if (!dateStr) {
    console.error('[publish] 処理対象が見つかりません。先に npm run weekly を実行してください。');
    process.exit(1);
  }

  const outDir = join(EXPORTS_DIR, dateStr);
  const digestPath = join(outDir, 'digest.json');
  const reportPath = join(outDir, `report_${dateStr}.md`);

  if (!existsSync(digestPath)) {
    console.error(`[publish] digest.json がありません: ${digestPath}\n  先に npm run weekly を実行してください。`);
    process.exit(1);
  }
  if (!existsSync(reportPath)) {
    console.error(
      `[publish] 週報がありません: ${reportPath}\n` +
        `  Cowork に PROMPT.md を貼って report_${dateStr}.md を生成してから再実行してください。`
    );
    process.exit(1);
  }

  if (!existsSync(KEY_PATH)) {
    console.error(`[publish] サービスアカウント鍵が見つかりません: ${KEY_PATH}`);
    process.exit(1);
  }

  const digest = JSON.parse(readFileSync(digestPath, 'utf8'));
  const reportMarkdown = readFileSync(reportPath, 'utf8');

  // メンバー寸評（ひとことMC）をカルテ用に抜き出し、本文からは除外
  const { notes: memberNotes, mdStripped } = extractMemberNotes(reportMarkdown);

  marked.setOptions({ gfm: true, breaks: false });
  const reportHtml = sanitizeHtml(marked.parse(mdStripped));

  // ドキュメントが肥大化していないか軽くチェック（Firestore 1ドキュメント=1MB上限）
  const approxBytes = Buffer.byteLength(JSON.stringify(digest)) + Buffer.byteLength(reportHtml);
  if (approxBytes > 950 * 1024) {
    console.warn(
      `[publish] 警告: ドキュメントが約 ${(approxBytes / 1024).toFixed(0)}KB と大きめです（上限1MB）。` +
        ` 将来 digest を weekly_digests に分離するか Storage への退避を検討してください。`
    );
  }

  const wc = digest.weeklyChallenge;
  const coverPeriodLabel = wc?.period?.label || null;
  const nextWeekExercises = (digest.nextWeekConfirmed?.exercises || []).map((e) => ({
    name: e.name,
    barbarian: !!e.barbarian,
  }));

  const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  await db.collection('weekly_reports').doc(dateStr).set({
    exportDate: dateStr,
    coverPeriodLabel,
    reportHtml,
    reportMarkdown,
    memberNotes, // { userName: ひとことMC } … report.js がカルテ各カードへ差し込む
    digest,
    nextWeekExercises,
    publishedAt: FieldValue.serverTimestamp(),
  });

  console.log(
    `[publish] 完了: weekly_reports/${dateStr} を配信しました（約${(approxBytes / 1024).toFixed(0)}KB）。\n` +
      `  対象週: ${coverPeriodLabel || '-'} ／ メンバー寸評: ${Object.keys(memberNotes).length}人ぶん抽出\n` +
      `  → アプリの「ウィークリー」ページに即反映されます。`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('[publish] 失敗:', err);
  process.exit(1);
});
