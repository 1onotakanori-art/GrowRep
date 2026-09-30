import { describe, expect, it } from 'vitest';
import {
  formatSuggestionDate,
  normalizeSuggestionInput,
  validateSuggestionInput,
  SUGGESTION_BODY_MAX,
  SUGGESTION_TITLE_MAX,
} from '../suggestion-box';

describe('validateSuggestionInput', () => {
  it('タイトルと本文があれば OK', () => {
    expect(validateSuggestionInput({ title: '要望', body: '本文' })).toBeNull();
  });

  it('空白だけのタイトル・本文は空とみなす', () => {
    expect(validateSuggestionInput({ title: '  ', body: '本文' })).toBe(
      'タイトルを入力してください',
    );
    expect(validateSuggestionInput({ title: '要望', body: ' \n ' })).toBe(
      '本文を入力してください',
    );
  });

  it('上限ちょうどは OK、超えたらエラー', () => {
    const title = 'あ'.repeat(SUGGESTION_TITLE_MAX);
    const body = 'い'.repeat(SUGGESTION_BODY_MAX);
    expect(validateSuggestionInput({ title, body })).toBeNull();
    expect(validateSuggestionInput({ title: title + 'あ', body })).toMatch(
      /タイトルは/,
    );
    expect(validateSuggestionInput({ title, body: body + 'い' })).toMatch(
      /本文は/,
    );
  });

  it('前後の空白は上限の計算に含めない', () => {
    const title = ` ${'あ'.repeat(SUGGESTION_TITLE_MAX)} `;
    expect(validateSuggestionInput({ title, body: '本文' })).toBeNull();
  });
});

describe('normalizeSuggestionInput', () => {
  it('前後の空白は落とし、本文途中の改行は残す', () => {
    expect(
      normalizeSuggestionInput({ title: ' 要望 ', body: '\n1行目\n\n2行目\n' }),
    ).toEqual({
      title: '要望',
      body: '1行目\n\n2行目',
    });
  });
});

describe('formatSuggestionDate', () => {
  it('JST で表示する（UTC 15:05 は翌日 0:05）', () => {
    expect(formatSuggestionDate(new Date('2026-09-30T15:05:00Z'))).toBe(
      '2026/10/1 00:05',
    );
  });

  it('サーバー時刻が未確定なら送信中', () => {
    expect(formatSuggestionDate(null)).toBe('送信中…');
  });
});
