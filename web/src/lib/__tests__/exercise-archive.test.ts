import { describe, expect, it } from 'vitest';
import {
  archiveBlockReason,
  findOrphanExercises,
  formatArchivedDate,
  planArchive,
  planRestore,
  sortArchived,
  stripArchiveMeta,
  validateOrphanName,
  type Archived,
} from '../exercise-archive';

interface Ex {
  name: string;
  createdBy?: string;
  tags?: string[];
}

const active: Record<string, Ex> = {
  free_1: { name: '腕立て', createdBy: 'u1', tags: ['胸'] },
  free_2: { name: '懸垂', createdBy: 'u2' },
};
const actor = { uid: 'u1', name: 'たろう' };
const now = new Date('2026-10-18T03:00:00Z');

describe('planArchive', () => {
  it('種目マップから外してアーカイブへ移す（元のマップは変えない）', () => {
    const next = planArchive(active, {}, 'free_1', actor, now);
    expect(Object.keys(next.active)).toEqual(['free_2']);
    expect(next.archive.free_1).toEqual({
      name: '腕立て',
      createdBy: 'u1',
      tags: ['胸'],
      archivedAt: '2026-10-18T03:00:00.000Z',
      archivedBy: 'u1',
      archivedByName: 'たろう',
    });
    expect(active.free_1).toBeDefined();
  });
  it('無い種目はエラー', () => {
    expect(() => planArchive(active, {}, 'free_9', actor)).toThrow(/見つかりません/);
  });
});

describe('planRestore', () => {
  it('アーカイブの印を外して種目マップへ戻す', () => {
    const archived = planArchive(active, {}, 'free_1', actor, now);
    const back = planRestore(archived.active, archived.archive, 'free_1');
    expect(back.active.free_1).toEqual(active.free_1);
    expect(back.archive).toEqual({});
  });
  it('アーカイブに無い・すでに戻っている場合はエラー', () => {
    expect(() => planRestore(active, {}, 'free_1')).toThrow(/見つかりません/);
    const archive = {
      free_1: { ...active.free_1, archivedAt: '', archivedBy: null, archivedByName: null },
    };
    expect(() => planRestore(active, archive, 'free_1')).toThrow(/すでに/);
  });
});

describe('stripArchiveMeta', () => {
  it('archivedAt / archivedBy / archivedByName だけを外す', () => {
    const ex: Archived<Ex> = {
      name: 'A',
      createdBy: 'u1',
      archivedAt: 'x',
      archivedBy: 'u1',
      archivedByName: 'n',
    };
    expect(stripArchiveMeta(ex)).toEqual({ name: 'A', createdBy: 'u1' });
  });
});

describe('findOrphanExercises', () => {
  it('投稿にだけ残っている free_ の種目を、投稿の多い順に', () => {
    const list = findOrphanExercises(
      { free_1: 3, free_old: 2, free_older: 5, free_arch: 4, ds_1: 9, interval: 7, free_zero: 0 },
      active,
      { free_arch: {} },
    );
    expect(list).toEqual([
      { key: 'free_older', postCount: 5 },
      { key: 'free_old', postCount: 2 },
    ]);
  });
});

describe('validateOrphanName', () => {
  it('空白だけ・長すぎる名前はだめ', () => {
    expect(validateOrphanName('  ')).toMatch(/入力/);
    expect(validateOrphanName('あ'.repeat(21))).toMatch(/20文字/);
    expect(validateOrphanName(' 腕立て ')).toBeNull();
  });
});

describe('archiveBlockReason', () => {
  it('今週のチャレンジ種目・今日のデイリー種目は止める', () => {
    expect(archiveBlockReason('free_1', { weeklyKeys: ['free_1'] })).toMatch(/週間チャレンジ/);
    expect(archiveBlockReason('free_2', { dailyKey: 'free_2' })).toMatch(/デイリー/);
    expect(archiveBlockReason('free_3', { weeklyKeys: ['free_1'], dailyKey: 'free_2' })).toBeNull();
    expect(archiveBlockReason('free_3', {})).toBeNull();
  });
});

describe('sortArchived / formatArchivedDate', () => {
  it('新しくアーカイブした順', () => {
    const meta = (archivedAt: string) => ({ name: 'x', archivedAt, archivedBy: null, archivedByName: null });
    const sorted = sortArchived({
      a: meta('2026-10-01T00:00:00Z'),
      b: meta('2026-10-17T00:00:00Z'),
      c: meta('2026-09-01T00:00:00Z'),
    });
    expect(sorted.map(([k]) => k)).toEqual(['b', 'a', 'c']);
  });
  it('JST の月/日', () => {
    expect(formatArchivedDate('2026-10-17T16:00:00Z')).toBe('10/18');
    expect(formatArchivedDate(undefined)).toBe('');
    expect(formatArchivedDate('bad')).toBe('');
  });
});
