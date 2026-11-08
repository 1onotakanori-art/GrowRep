import { useData } from '../context/DataContext';
import { useOpenExercise } from '../shell/ExerciseNav';
import { sortTagsByCatalog } from '../lib/tag-catalog';
import styles from './ExerciseTagsRow.module.css';

/**
 * 種目のタグ（属性順）と「種目詳細」ボタンの行。投稿（フリー）・デイリーで使う。
 * 詳細ボタンは種目タブの該当カードへ移動する（shell/ExerciseNav）。
 */
export default function ExerciseTagsRow({
  exerciseKey,
  tags,
  className,
}: {
  exerciseKey: string;
  tags: string[];
  className?: string;
}) {
  const { tagCatalog } = useData();
  const openExercise = useOpenExercise();
  const sorted = sortTagsByCatalog(tagCatalog, tags);
  if (sorted.length === 0 && !openExercise) return null;
  return (
    <div className={className ? `${styles.row} ${className}` : styles.row}>
      <div className={styles.tags}>
        {sorted.map((t) => (
          <span key={t} className="chip">
            {t}
          </span>
        ))}
      </div>
      {openExercise && (
        <button
          type="button"
          className={styles.detailBtn}
          onClick={() => openExercise(exerciseKey)}
        >
          種目詳細 <i className="fa-solid fa-chevron-right" />
        </button>
      )}
    </div>
  );
}
