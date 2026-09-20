import { useMemo, useState } from 'react';
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
  deleteDropsetExercise,
  editDropsetExercise,
} from '../lib/dropset-engine';
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

  async function handleDelete(key: string) {
    if (
      !confirm(
        `種目「${exercises[key]?.name}」を削除しますか？\n\nこれまでの挑戦記録は残りますが、一覧には出なくなります。`,
      )
    )
      return;
    setBusy(true);
    try {
      const map = await deleteDropsetExercise(key);
      setExercises(map);
      setFormModal(null);
      toast('種目を削除しました', 'success');
      refresh();
    } catch {
      toast('削除に失敗しました', 'error');
    } finally {
      setBusy(false);
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

      {formModal && (
        <DropsetExerciseFormModal
          mode={formModal.mode}
          initial={
            formModal.mode === 'edit' ? exercises[formModal.key] : undefined
          }
          busy={busy}
          onClose={() => setFormModal(null)}
          onSubmit={handleFormSubmit}
          onDelete={
            formModal.mode === 'edit'
              ? () => handleDelete(formModal.key)
              : undefined
          }
        />
      )}
    </div>
  );
}
