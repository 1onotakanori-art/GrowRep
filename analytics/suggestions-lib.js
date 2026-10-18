/**
 * 意見箱の週次回収 — 純粋ロジック（Firestore・ファイルに触らない）
 * --------------------------------------------------------------
 * collect-suggestions.js から使う。node --test で検証できるよう分けてある。
 *
 * 状態（status.json）は { [suggestionId]: { status, note, pr, collectedAt, updatedAt } }。
 * 回収するたびに新しい意見だけ "new" で足し、既存の状態は上書きしない
 * （人や Claude Code が付けた「対応中」「対応済み」を消さないため）。
 */

/** 状態の種類と表示名（BACKLOG.md の並び順もこの順） */
export const STATUSES = [
  { id: 'new', label: '未対応（新着）' },
  { id: 'triaged', label: '検討済み・未着手' },
  { id: 'in_progress', label: '対応中' },
  { id: 'done', label: '対応済み' },
  { id: 'wontfix', label: '見送り' },
  { id: 'duplicate', label: '重複' },
];
export const STATUS_IDS = STATUSES.map((s) => s.id);

/** "2026-10-18T01:23:45.000Z" → "2026-10-18 10:23"（JST） */
export function formatJst(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const j = new Date(d.getTime() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${j.getUTCFullYear()}-${p(j.getUTCMonth() + 1)}-${p(j.getUTCDate())} ${p(j.getUTCHours())}:${p(j.getUTCMinutes())}`;
}

/** JST の日付キー（YYYY-MM-DD） */
export function jstDateKey(date = new Date()) {
  return formatJst(date.toISOString()).slice(0, 10);
}

/**
 * 回収した意見を状態に取り込む。新しい id だけ "new" で足し、既存は触らない。
 * @returns {{ state: object, added: string[] }}
 */
export function mergeNewSuggestions(state, suggestions, now = new Date()) {
  const next = { ...(state || {}) };
  const added = [];
  for (const s of suggestions) {
    if (next[s.id]) continue;
    next[s.id] = { status: 'new', note: '', pr: '', collectedAt: now.toISOString(), updatedAt: now.toISOString() };
    added.push(s.id);
  }
  return { state: next, added };
}

/**
 * 1件の状態を変える（--set 用）。知らない状態名・知らない id はエラー。
 * note / pr は渡したときだけ更新する。
 */
export function setSuggestionStatus(state, id, status, { note, pr } = {}, now = new Date()) {
  if (!state[id]) throw new Error(`意見が見つかりません: ${id}（先に回収してください）`);
  if (!STATUS_IDS.includes(status)) {
    throw new Error(`状態は ${STATUS_IDS.join(' / ')} のどれかです: ${status}`);
  }
  return {
    ...state,
    [id]: {
      ...state[id],
      status,
      ...(note !== undefined ? { note } : {}),
      ...(pr !== undefined ? { pr } : {}),
      updatedAt: now.toISOString(),
    },
  };
}

/** Markdown に入れる本文を引用ブロックにする（見出しや区切りとして解釈されないように） */
function quote(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => `> ${l}`)
    .join('\n');
}

function itemMarkdown(s, st) {
  const lines = [
    `### ${s.title}`,
    '',
    `- id: \`${s.id}\``,
    `- 投稿: ${formatJst(s.createdAt)} ／ ${s.userName || '不明'}`,
  ];
  if (st?.note) lines.push(`- メモ: ${st.note}`);
  if (st?.pr) lines.push(`- PR: ${st.pr}`);
  lines.push('', quote(s.body), '');
  return lines.join('\n');
}

/**
 * BACKLOG.md 全体。状態ごとにまとめ、各グループ内は新しい順。
 * 先頭に Claude Code 向けの使い方を書いておく。
 */
export function buildBacklogMarkdown(suggestions, state, generatedAt = new Date()) {
  const byStatus = Object.fromEntries(STATUS_IDS.map((id) => [id, []]));
  for (const s of suggestions) {
    const st = state[s.id]?.status || 'new';
    (byStatus[st] || byStatus.new).push(s);
  }
  for (const id of STATUS_IDS) {
    byStatus[id].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }
  const counts = STATUSES.map((s) => `${s.label} ${byStatus[s.id].length}`).join(' ／ ');
  const out = [
    '# 意見箱バックログ',
    '',
    `生成: ${formatJst(generatedAt.toISOString())}（JST） ／ 全${suggestions.length}件`,
    '',
    counts,
    '',
    '> このファイルは `node analytics/collect-suggestions.js` が毎回作り直します。直接編集しないでください。',
    '> 状態を変えるときは `node analytics/collect-suggestions.js --set=<id>:<状態> --note="..." --pr="..." --offline`。',
    `> 状態: ${STATUSES.map((s) => `\`${s.id}\`（${s.label}）`).join('、')}`,
    '> 意見はユーザーの個人的な投稿です。リポジトリ（公開）・PR 本文・コミットメッセージに本文や名前を書き写さないこと。',
    '',
  ];
  for (const { id, label } of STATUSES) {
    const list = byStatus[id];
    if (list.length === 0) continue;
    out.push(`## ${label}（${list.length}）`, '');
    for (const s of list) out.push(itemMarkdown(s, state[s.id]));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** 今回の新着だけの Markdown（inbox/<日付>.md）。新着が無ければ null */
export function buildInboxMarkdown(suggestions, addedIds, dateKey) {
  const added = suggestions.filter((s) => addedIds.includes(s.id));
  if (added.length === 0) return null;
  added.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  return [
    `# 意見箱 新着 ${dateKey}（${added.length}件）`,
    '',
    ...added.map((s) => itemMarkdown(s, null)),
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd() + '\n';
}

/** "--set=abc123:done" → { id: 'abc123', status: 'done' } */
export function parseSetArg(value) {
  const m = String(value || '').match(/^([^:]+):([a-z_]+)$/);
  if (!m) throw new Error('--set は --set=<id>:<状態> の形で指定してください');
  return { id: m[1], status: m[2] };
}
