import { useState } from 'react';
import { EmptyState } from '../../components/ui';
import {
  formatArchivedDate,
  ORPHAN_NAME_MAX,
  sortArchived,
  validateOrphanName,
  type Archived,
  type OrphanExercise,
} from '../../lib/exercise-archive';
import styles from './ArchivePanel.module.css';

interface ArchivedLike {
  name: string;
  icon?: string;
  rule?: string;
  createdByName?: string;
}

/**
 * アーカイブ済みの種目一覧と「戻す」ボタン。フリー・ドロップセット共通。
 * orphans を渡すと、名前が残っていない過去の種目（旧版で削除済み）も出す。
 */
export default function ArchivePanel<T extends ArchivedLike>({
  archive,
  postCounts,
  busyKey,
  onRestore,
  orphans,
  onRestoreOrphan,
}: {
  archive: Record<string, Archived<T>> | null;
  postCounts?: Record<string, number>;
  busyKey: string | null;
  onRestore: (key: string) => void;
  orphans?: OrphanExercise[];
  onRestoreOrphan?: (key: string, name: string) => void;
}) {
  if (archive === null) {
    return (
      <div className={styles.loading}>
        <i className="fa-solid fa-circle-notch spin" /> 読み込み中…
      </div>
    );
  }
  const list = sortArchived(archive);
  return (
    <div className={styles.wrap}>
      <p className={styles.lead}>
        アーカイブした種目は、一覧・週間チャレンジの抽選・デイリーミッションから外れます。
        これまでの記録は消えず、戻せばそのまま使えます。
      </p>

      {list.length === 0 ? (
        <EmptyState icon="fa-box-archive" message="アーカイブした種目はありません" />
      ) : (
        <ul className={styles.list}>
          {list.map(([key, ex]) => (
            <li key={key} className={styles.item}>
              <span className={styles.icon}>
                <i className={`fa-solid ${ex.icon || 'fa-dumbbell'}`} />
              </span>
              <div className={styles.body}>
                <span className={styles.name}>{ex.name}</span>
                <span className={styles.meta}>
                  {formatArchivedDate(ex.archivedAt)} に
                  {ex.archivedByName ? ` ${ex.archivedByName} さんが` : ''}アーカイブ
                  {postCounts && ` ・投稿 ${postCounts[key] || 0}件`}
                  {ex.createdByName && ` ・作成 ${ex.createdByName}`}
                </span>
              </div>
              <button
                className={styles.restore}
                disabled={busyKey !== null}
                onClick={() => onRestore(key)}
              >
                {busyKey === key ? (
                  <i className="fa-solid fa-circle-notch spin" />
                ) : (
                  <>
                    <i className="fa-solid fa-rotate-left" /> 戻す
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {orphans && orphans.length > 0 && onRestoreOrphan && (
        <>
          <h3 className={styles.subTitle}>
            <i className="fa-solid fa-ghost" /> 名前が残っていない過去の種目
          </h3>
          <p className={styles.lead}>
            旧版で「削除」された種目です。投稿は残っているので、名前を付けると種目として戻せます。
          </p>
          <ul className={styles.list}>
            {orphans.map((o) => (
              <OrphanRow
                key={o.key}
                orphan={o}
                busy={busyKey === o.key}
                disabled={busyKey !== null}
                onRestore={onRestoreOrphan}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function OrphanRow({
  orphan,
  busy,
  disabled,
  onRestore,
}: {
  orphan: OrphanExercise;
  busy: boolean;
  disabled: boolean;
  onRestore: (key: string, name: string) => void;
}) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  function submit() {
    const e = validateOrphanName(name);
    setErr(e || '');
    if (!e) onRestore(orphan.key, name.trim());
  }
  return (
    <li className={styles.orphan}>
      <span className={styles.meta}>
        <i className="fa-solid fa-key" /> {orphan.key} ・投稿 {orphan.postCount}件
      </span>
      <div className={styles.orphanForm}>
        <input
          value={name}
          maxLength={ORPHAN_NAME_MAX}
          placeholder="種目名（必須）"
          aria-label={`${orphan.key} の種目名`}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        <button className={styles.restore} disabled={disabled} onClick={submit}>
          {busy ? (
            <i className="fa-solid fa-circle-notch spin" />
          ) : (
            <>
              <i className="fa-solid fa-rotate-left" /> 戻す
            </>
          )}
        </button>
      </div>
      {err && <span className={styles.err}>{err}</span>}
    </li>
  );
}
