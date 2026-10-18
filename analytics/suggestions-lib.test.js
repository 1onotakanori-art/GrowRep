// node --test で実行（npm test）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBacklogMarkdown,
  buildInboxMarkdown,
  formatJst,
  jstDateKey,
  mergeNewSuggestions,
  parseSetArg,
  setSuggestionStatus,
} from './suggestions-lib.js';

const now = new Date('2026-10-18T08:00:00Z');
const s = (id, title, createdAt, body = '本文') => ({ id, title, body, userId: 'u', userName: 'たろう', createdAt });
const list = [s('a', '古い要望', '2026-10-01T00:00:00Z'), s('b', '新しい要望', '2026-10-17T00:00:00Z', '1行目\n## 見出しっぽい行')];

test('formatJst / jstDateKey は JST', () => {
  assert.equal(formatJst('2026-10-17T15:30:00Z'), '2026-10-18 00:30');
  assert.equal(formatJst(null), '-');
  assert.equal(jstDateKey(new Date('2026-10-17T15:30:00Z')), '2026-10-18');
});

test('mergeNewSuggestions は新しい id だけ new で足し、既存の状態を消さない', () => {
  const state = { a: { status: 'done', note: '対応済', pr: 'x', collectedAt: '', updatedAt: '' } };
  const { state: next, added } = mergeNewSuggestions(state, list, now);
  assert.deepEqual(added, ['b']);
  assert.equal(next.a.status, 'done');
  assert.equal(next.b.status, 'new');
  assert.equal(next.b.collectedAt, now.toISOString());
});

test('setSuggestionStatus は状態名と id を確かめ、渡した項目だけ変える', () => {
  const { state } = mergeNewSuggestions({}, list, now);
  const next = setSuggestionStatus(state, 'a', 'in_progress', { pr: 'https://example.com/pr/1' }, now);
  assert.equal(next.a.status, 'in_progress');
  assert.equal(next.a.pr, 'https://example.com/pr/1');
  assert.equal(next.a.note, '');
  assert.throws(() => setSuggestionStatus(state, 'zzz', 'done'), /見つかりません/);
  assert.throws(() => setSuggestionStatus(state, 'a', 'closed'), /どれか/);
});

test('buildBacklogMarkdown は状態ごと・新しい順で、本文を引用にする', () => {
  const { state } = mergeNewSuggestions({ a: { status: 'done', note: 'PRで対応', pr: '', collectedAt: '', updatedAt: '' } }, list, now);
  const md = buildBacklogMarkdown(list, state, now);
  assert.match(md, /全2件/);
  assert.ok(md.indexOf('## 未対応（新着）（1）') < md.indexOf('## 対応済み（1）'));
  assert.match(md, /> 1行目\n> ## 見出しっぽい行/);
  assert.match(md, /- メモ: PRで対応/);
  assert.doesNotMatch(md, /## 対応中/); // 0件のグループは出さない
});

test('buildInboxMarkdown は今回の新着だけ。無ければ null', () => {
  assert.equal(buildInboxMarkdown(list, [], '2026-10-18'), null);
  const md = buildInboxMarkdown(list, ['b'], '2026-10-18');
  assert.match(md, /新着 2026-10-18（1件）/);
  assert.match(md, /新しい要望/);
  assert.doesNotMatch(md, /古い要望/);
});

test('parseSetArg', () => {
  assert.deepEqual(parseSetArg('abc123:done'), { id: 'abc123', status: 'done' });
  assert.throws(() => parseSetArg('abc123'), /--set=/);
});
