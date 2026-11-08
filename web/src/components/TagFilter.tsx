import { groupTags, type TagCatalog } from '../lib/tag-catalog';
import styles from './TagFilter.module.css';

/**
 * 絞り込み用のタグを属性ごとの行に並べる（部位: 胸 背中 … / 負荷: 自重 …）。
 * 1行に収まらない属性は横スクロール。選び方のルール（属性ごとに1つ）は
 * lib/exercise-filter.ts の toggleFilterTag。
 */
export default function TagFilter({
  catalog,
  tags,
  selected,
  onToggle,
}: {
  catalog: TagCatalog;
  /** 候補のタグ（種目に付いているもの） */
  tags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  const groups = groupTags(catalog, tags);
  if (groups.length === 0) return null;
  return (
    <div className={styles.wrap}>
      {groups.map((g) => (
        <div key={g.id} className={styles.row} role="group" aria-label={g.label}>
          <span className={styles.label}>{g.label}</span>
          <div className={styles.chips}>
            {g.tags.map((t) => {
              const on = selected.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  className={on ? styles.tagOn : styles.tag}
                  aria-pressed={on}
                  onClick={() => onToggle(t)}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
