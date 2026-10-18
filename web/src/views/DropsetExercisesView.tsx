import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDropset } from '../context/DropsetContext';
import { useMode } from '../context/ModeContext';
import { useToast } from '../context/ToastContext';
import { ViewHeader, EmptyState, Skeleton } from '../components/ui';
import DropsetExerciseFormModal, {
  type DropsetExerciseFormValue,
} from '../features/dropset/DropsetExerciseFormModal';
import {
  addDropsetExercise,
  editDropsetExercise,
  loadDropsetExercises,
} from '../lib/dropset-engine';
import ArchivePanel from '../features/exercises/ArchivePanel';
import type { Archived } from '../lib/exercise-archive';
import {
  archiveExercise,
  loadArchivedExercises,
  restoreArchivedExercise,
} from '../lib/exercise-archive-engine';
import type { DropsetExercise } from '../lib/types';
import { TARGET_REPS, formatWeight, progressOf } from '../lib/dropset';
import styles from './DropsetExercisesView.module.css';

export default function DropsetExercisesView() {
  const { user, userData } = useAuth();
  const { refresh } = useMode();
  const { exercises, setExercises, attempts, loading } = useDropset();
  const { toast } = useToast();

  const [formModal, setFormModal] = useState<
    { mode: 'add' } | { mode: 'edit'; key: string } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archive, setArchive] = useState<Record<
    string,
    Archived<DropsetExercise>
  > | null>(null);
  const [archiveBusyKey, setArchiveBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!showArchive || archive !== null) return;
    loadArchivedExercises<DropsetExercise>('settings_dropset')
      .then(setArchive)
      .catch((e) => {
        console.error('[アーカイブ] 読み込み失敗:', e);
        setArchive({});
        toast('アーカイブの読み込みに失敗しました', 'error');
      });
  }, [showArchive, archive, toast]);

  const postCounts = useMemo(() => {
    const c: Record<string, number> = {};
    attempts.forEach((a) => (c[a.exerciseType] = (c[a.exerciseType] || 0) + 1));
    return c;
  }, [attempts]);

  const list = useMemo(
    () =>
      Object.entries(exercises).sort(([, a], [, b]) =>
        a.name.localeCompare(b.name, 'ja'),
      ),
    [exercises],
  );

  async function handleFormSubmit(v: DropsetExerciseFormValue) {
    if (!formModal || !user) return;
    setBusy(true);
    try {
      const map =
        formModal.mode === 'add'
          ? await addDropsetExercise(v, {
              uid: user.uid,
              name: userData?.userName || user.email || 'Unknown',
            })
          : await editDropsetExercise(formModal.key, v);
      setExercises(map);
      setFormModal(null);
      toast(
        formModal.mode === 'add' ? '種目を追加しました' : '種目を更新しました',
        'success',
      );
      refresh();
    } catch {
      toast('保存に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive(key: string) {
    if (!user) return;
    const name = exercises[key]?.name;
    if (
      !confirm(
        `種目「${name}」をアーカイブしますか？\n\n一覧から外れます。これまでの挑戦記録は残り、「アーカイブ済みの種目」からいつでも戻せます。`,
      )
    )
      return;
    setBusy(true);
    try {
      await archiveExercise<DropsetExercise>('settings_dropset', key, {
        uid: user.uid,
        name: userData?.userName || user.email || 'Unknown',
      });
      setExercises(await loadDropsetExercises());
      setArchive(null);
      setFormModal(null);
      toast(`「${name}」をアーカイブしました`, 'success');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'アーカイブに失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(key: string) {
    const name = archive?.[key]?.name;
    setArchiveBusyKey(key);
    try {
      await restoreArchivedExercise<DropsetExercise>('settings_dropset', key);
      setExercises(await loadDropsetExercises());
      setArchive(await loadArchivedExercises<DropsetExercise>('settings_dropset'));
      toast(`「${name}」を戻しました`, 'success');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : '戻せませんでした', 'error');
    } finally {
      setArchiveBusyKey(null);
    }
  }

  if (loading) return <Skeleton count={4} />;

  return (
    <div className="fade-in">
      <ViewHeader
        icon="fa-weight-hanging"
        title="ドロップセット種目"
        action={
          <button
            className={styles.addBtn}
            onClick={() => setFormModal({ mode: 'add' })}
          >
            <i className="fa-solid fa-plus" /> 追加
          </button>
        }
      />

      <p className={styles.lead}>
        同じ重量で <strong>{TARGET_REPS.join(' - ')}</strong>{' '}
        をこなせたら、その重量はクリア。次の重量に進みます。
      </p>

      {list.length === 0 ? (
        <EmptyState
          icon="fa-weight-hanging"
          message="種目がありません。「追加」から登録できます"
        />
      ) : (
        <div className={styles.list}>
          {list.map(([key, ex]) => {
            const isMine = ex.createdBy === user?.uid;
            const p = user
              ? progressOf(attempts, user.uid, key, ex)
              : null;
            return (
              <div key={key} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.icon}>
                    <i className={`fa-solid ${ex.icon || 'fa-dumbbell'}`} />
                  </span>
                  <div className={styles.titleWrap}>
                    <span className={styles.name}>{ex.name}</span>
                    <span className={styles.meta}>
                      {formatWeight(ex.startWeight)}kg から / +
                      {formatWeight(ex.step)}kg ずつ
                    </span>
                  </div>
                  {isMine && (
                    <button
                      className={styles.editBtn}
                      onClick={() => setFormModal({ mode: 'edit', key })}
                      aria-label="編集"
                    >
                      <i className="fa-solid fa-pen" />
                    </button>
                  )}
                </div>

                {ex.rule && <p className={styles.rule}>{ex.rule}</p>}

                {p && (
                  <div className={styles.progress}>
                    <span className={styles.progItem}>
                      <span className={styles.progLabel}>クリア済み</span>
                      <strong>
                        {p.clearedMax == null
                          ? '—'
                          : `${formatWeight(p.clearedMax)}kg`}
                      </strong>
                    </span>
                    <i className="fa-solid fa-arrow-right" />
                    <span className={styles.progItem}>
                      <span className={styles.progLabel}>次の挑戦</span>
                      <strong className={styles.next}>
                        {formatWeight(p.suggestedWeight)}kg
                      </strong>
                    </span>
                  </div>
                )}

                {(ex.tags || []).length > 0 && (
                  <div className={styles.cardTags}>
                    {ex.tags.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        className={styles.archiveToggle}
        onClick={() => setShowArchive((v) => !v)}
        aria-expanded={showArchive}
      >
        <i className="fa-solid fa-box-archive" /> アーカイブ済みの種目
        <i className={`fa-solid fa-chevron-${showArchive ? 'up' : 'down'}`} />
      </button>
      {showArchive && (
        <ArchivePanel
          archive={archive}
          postCounts={postCounts}
          busyKey={archiveBusyKey}
          onRestore={handleRestore}
        />
      )}

      {formModal && (
        <DropsetExerciseFormModal
          mode={formModal.mode}
          initial={
            formModal.mode === 'edit' ? exercises[formModal.key] : undefined
          }
          busy={busy}
          onClose={() => setFormModal(null)}
          onSubmit={handleFormSubmit}
          onArchive={
            formModal.mode === 'edit'
              ? () => handleArchive(formModal.key)
              : undefined
          }
        />
      )}
    </div>
  );
}
