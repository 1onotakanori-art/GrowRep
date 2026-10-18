/**
 * 意見箱の週次回収
 * --------------------------------------------------------------
 * アプリの「意見箱」（Firestore の suggestions コレクション）を読み、
 * 手元の analytics/suggestions/ に次のファイルを作る。
 *
 *   BACKLOG.md          … 全件を状態ごとにまとめたもの（毎回作り直す）
 *   status.json         … 各意見の状態（new / triaged / in_progress / done / wontfix / duplicate）
 *   inbox/<日付>.md     … その回に初めて回収した意見だけ（新着があった回のみ）
 *
 * Claude Code は BACKLOG.md を読んで改修案を出し、対応したら --set で状態を更新する
 * （.claude/skills/suggestions-triage/SKILL.md 参照）。
 *
 * ⚠️ 意見はユーザーの個人的な投稿。suggestions/ は .gitignore 済み（リポジトリは公開）。
 *
 * 使い方:
 *   node collect-suggestions.js                          … 回収して BACKLOG.md を更新
 *   node collect-suggestions.js --offline                … Firestore を読まず手元の控えから作り直す
 *   node collect-suggestions.js --set=<id>:done --note="..." --pr="https://..." --offline
 *
 * 毎週日曜の announce（select → export → digest）の最後に自動で走る。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBacklogMarkdown,
  buildInboxMarkdown,
  jstDateKey,
  mergeNewSuggestions,
  parseSetArg,
  setSuggestionStatus,
} from './suggestions-lib.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 既定は analytics/serviceAccountKey.json。git worktree など鍵の無い場所から動かすときは
// 環境変数 GROWREP_SA_KEY で鍵のパスを渡す（鍵そのものはコピーしない）
const KEY_PATH = process.env.GROWREP_SA_KEY || join(__dirname, 'serviceAccountKey.json');
const OUT_DIR = join(__dirname, 'suggestions');
const INBOX_DIR = join(OUT_DIR, 'inbox');
const STATE_PATH = join(OUT_DIR, 'status.json');
/** 最後に回収した意見の控え（--offline で BACKLOG.md を作り直すときに使う） */
const CACHE_PATH = join(OUT_DIR, 'suggestions.json');
const BACKLOG_PATH = join(OUT_DIR, 'BACKLOG.md');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/s);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function fetchSuggestions() {
  if (!existsSync(KEY_PATH)) {
    throw new Error(
      `サービスアカウント鍵が見つかりません: ${KEY_PATH}\n` +
        '  analytics/README.md の「初回セットアップ」を参照。手元の控えから作り直すだけなら --offline を付けてください。',
    );
  }
  const { initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))) });
  const snap = await getFirestore().collection('suggestions').orderBy('createdAt', 'asc').get();
  return snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      title: v.title || '(無題)',
      body: v.body || '',
      userId: v.userId || '',
      userName: v.userName || '',
      createdAt: v.createdAt?.toDate?.().toISOString?.() || null,
    };
  });
}

async function main() {
  mkdirSync(INBOX_DIR, { recursive: true });
  const now = new Date();
  let state = readJson(STATE_PATH, {});

  let suggestions;
  let added = [];
  if (args.offline) {
    suggestions = readJson(CACHE_PATH, []);
  } else {
    suggestions = await fetchSuggestions();
    writeJson(CACHE_PATH, suggestions);
    ({ state, added } = mergeNewSuggestions(state, suggestions, now));
  }

  if (args.set) {
    const { id, status } = parseSetArg(args.set);
    state = setSuggestionStatus(
      state,
      id,
      status,
      {
        note: typeof args.note === 'string' ? args.note : undefined,
        pr: typeof args.pr === 'string' ? args.pr : undefined,
      },
      now,
    );
    console.log(`[suggestions] ${id} を ${status} にしました`);
  }

  writeJson(STATE_PATH, state);
  writeFileSync(BACKLOG_PATH, buildBacklogMarkdown(suggestions, state, now), 'utf8');

  const dateKey = jstDateKey(now);
  const inbox = buildInboxMarkdown(suggestions, added, dateKey);
  if (inbox) writeFileSync(join(INBOX_DIR, `${dateKey}.md`), inbox, 'utf8');

  const open = suggestions.filter((s) => ['new', 'triaged'].includes(state[s.id]?.status || 'new')).length;
  console.log(
    `[suggestions] 全${suggestions.length}件 ／ 新着${added.length}件 ／ 未対応${open}件\n` +
      `  → ${BACKLOG_PATH}${inbox ? `\n  → ${join(INBOX_DIR, `${dateKey}.md`)}` : ''}`,
  );
}

main().catch((err) => {
  console.error('[suggestions] 失敗:', err.message || err);
  process.exit(1);
});
