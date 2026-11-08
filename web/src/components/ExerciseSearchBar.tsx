import type { ReactNode } from 'react';
import { useData } from '../context/DataContext';
import {
  isFilterActive,
  toggleFilterTag,
  type ExerciseFilter,
} from '../lib/exercise-filter';
import TagFilter from './TagFilter';
import styles from './ExerciseSearchBar.module.css';

/**
 * 種目の検索欄 + タグ絞り込み（属性ごとの行）。種目数が多い画面
 * （種目・投稿・ランキング・成長記録）で共通利用。絞り込みロジックは lib/exercise-filter.ts。
 */
export default function ExerciseSearchBar({
  value,
  onChange,
  tags = [],
  placeholder = '種目を検索…',
  resultCount,
  narrowed = false,
  extra,
  searchExtra,
  className,
}: {
  value: ExerciseFilter;
  onChange: (v: ExerciseFilter) => void;
  /** 空ならタグ行を出さない */
  tags?: string[];
  placeholder?: string;
  /** 絞り込み中に「n件」を表示する */
  resultCount?: number;
  /** extra 側の絞り込みが効いている時 true（件数表示の判定に使う） */
  narrowed?: boolean;
  /** タグ行の後ろに置く追加の絞り込み（トグルなど） */
  extra?: ReactNode;
  /** 検索欄の右端に置く要素（並び替えセレクトなど） */
  searchExtra?: ReactNode;
  /** 置き場所に合わせた余白の上書き用 */
  className?: string;
}) {
  const { tagCatalog } = useData();
  const active = isFilterActive(value) || narrowed;
  return (
    <div className={className ? `${styles.wrap} ${className}` : styles.wrap}>
      <div className={styles.searchRow}>
        <i className="fa-solid fa-magnifying-glass" />
        <input
          type="search"
          placeholder={placeholder}
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
          aria-label="種目を検索"
        />
        {value.query && (
          <button
            className={styles.clearBtn}
            onClick={() => onChange({ ...value, query: '' })}
            aria-label="検索語をクリア"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        )}
        {searchExtra}
      </div>
      {tags.length > 0 && (
        <TagFilter
          catalog={tagCatalog}
          tags={tags}
          selected={value.tags}
          onToggle={(t) => onChange(toggleFilterTag(value, t, tagCatalog))}
        />
      )}
      {(extra || value.tags.length > 0 || (active && resultCount != null)) && (
        <div className={styles.metaRow}>
          {extra}
          {value.tags.length > 0 && (
            <button
              type="button"
              className={styles.clearTags}
              onClick={() => onChange({ ...value, tags: [] })}
            >
              <i className="fa-solid fa-xmark" /> タグを解除
            </button>
          )}
          {active && resultCount != null && (
            <span className={styles.count}>{resultCount}件</span>
          )}
        </div>
      )}
    </div>
  );
}
