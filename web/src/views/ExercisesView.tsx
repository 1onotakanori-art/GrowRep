import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useMode } from '../context/ModeContext';
import { useToast } from '../context/ToastContext';
import { ViewHeader, EmptyState, StarRating, Barbadge } from '../components/ui';
import ExerciseFormModal, {
  type ExerciseFormValue,
} from '../features/exercises/ExerciseFormModal';
import RatingModal from '../features/exercises/RatingModal';
import ReviewsModal from '../features/exercises/ReviewsModal';
import {
  addFreeExercise,
  editFreeExercise,
  deleteFreeExercise,
} from '../lib/exercises';
import {
  getExerciseRatingSummaries,
  getUserExerciseRatings,
} from '../lib/ratings';
import type { ExerciseRatingSummary, FreeExercise } from '../lib/types';
import styles from './ExercisesView.module.css';

type Sort = 'name' | 'rating' | 'new';

export default function ExercisesView() {
  const { user, userData } = useAuth();
  const { refresh } = useMode();
  const { freeExercises, setFreeExercises } = useData();
  const { toast } = useToast();

  const [summaries, setSummaries] = useState<Record<string, ExerciseRatingSummary>>({});
  const [myRatings, setMyRatings] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('name');
  const [ratingsVersion, setRatingsVersion] = useState(0);

  const [formModal, setFormModal] = useState<
    { mode: 'add' } | { mode: 'edit'; key: string } | null
  >(null);
  const [ratingModal, setRatingModal] = useState<string | null>(null);
  const [reviewsModal, setReviewsModal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const keys = useMemo(() => Object.keys(freeExercises), [freeExercises]);

  useEffect(() => {
    (async () => {
      if (keys.length === 0) return;
      const [sum, mine] = await Promise.all([
        getExerciseRatingSummaries(keys),
        getUserExerciseRatings(keys),
      ]);
      setSummaries(sum);
      const mineMap: Record<string, boolean> = {};
      Object.keys(mine).forEach((k) => (mineMap[k] = true));
      setMyRatings(mineMap);
    })();
  }, [keys, ratingsVersion]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    Object.values(freeExercises).forEach((ex) =>
      (ex.tags || []).forEach((t) => s.add(t)),
    );
    return [...s];
  }, [freeExercises]);

  const list = useMemo(() => {
    let entries = Object.entries(freeExercises);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      entries = entries.filter(
        ([, ex]) =>
          ex.name.toLowerCase().includes(q) ||
          (ex.rule || '').toLowerCase().includes(q),
      );
    }
    if (tagFilter) {
      entries = entries.filter(([, ex]) => (ex.tags || []).includes(tagFilter));
    }
    entries.sort(([ka, a], [kb, b]) => {
      if (sort === 'rating') {
        return (summaries[kb]?.avgRating || 0) - (summaries[ka]?.avgRating || 0);
      }
      if (sort === 'new') {
        return kb.localeCompare(ka); // key に timestamp を含むため擬似的に新しい順
      }
      return a.name.localeCompare(b.name, 'ja');
    });
    return entries;
  }, [freeExercises, search, tagFilter, sort, summaries]);

  async function handleFormSubmit(v: ExerciseFormValue) {
    if (!formModal) return;
    setBusy(true);
    try {
      let map;
      if (formModal.mode === 'add') {
        map = await addFreeExercise(v, {
          uid: user!.uid,
          name: userData?.userName || user?.email || 'Unknown',
        });
        toast('種目を追加しました', 'success');
      } else {
        map = await editFreeExercise(formModal.key, v);
        toast('種目を更新しました', 'success');
      }
      setFreeExercises(map);
      setFormModal(null);
      refresh();
    } catch {
      toast('保存に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(key: string) {
    if (!confirm(`種目「${freeExercises[key]?.name}」を削除しますか？`)) return;
    setBusy(true);
    try {
      const map = await deleteFreeExercise(key);
      setFreeExercises(map);
      setFormModal(null);
      toast('種目を削除しました', 'success');
      refresh();
    } catch {
      toast('削除に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fade-in">
      <ViewHeader
        icon="fa-dumbbell"
        title="種目 & ルール"
        action={
          <button
            className={styles.addBtn}
            onClick={() => setFormModal({ mode: 'add' })}
          >
            <i className="fa-solid fa-plus" /> 追加
          </button>
        }
      />

      <div className={styles.controls}>
        <div className={styles.searchRow}>
          <i className="fa-solid fa-magnifying-glass" />
          <input
            placeholder="種目を検索…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className={styles.sortSel}
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            <option value="name">名前順</option>
            <option value="rating">評価順</option>
            <option value="new">新着順</option>
          </select>
        </div>
        {allTags.length > 0 && (
          <div className={styles.tagRow}>
            <button
              className={!tagFilter ? styles.tagOn : styles.tag}
              onClick={() => setTagFilter(null)}
            >
              すべて
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                className={tagFilter === t ? styles.tagOn : styles.tag}
                onClick={() => setTagFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState icon="fa-dumbbell" message="種目がありません" />
      ) : (
        <div className={styles.list}>
          {list.map(([key, ex]) => {
            const sum = summaries[key];
            const isMine =
              (ex as FreeExercise).createdBy === user?.uid;
            return (
              <div key={key} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.icon}>
                    <i className={`fa-solid ${ex.icon || 'fa-dumbbell'}`} />
                  </span>
                  <div className={styles.titleWrap}>
                    <span className={styles.name}>{ex.name}</span>
                    <StarRating
                      avg={sum?.avgRating}
                      count={sum?.ratingCount || 0}
                    />
                  </div>
                  {ex.barbarian && <Barbadge />}
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
                {(ex.tags || []).length > 0 && (
                  <div className={styles.cardTags}>
                    {ex.tags.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                    {ex.excludeFromWeekly && (
                      <span className={styles.exclChip}>
                        <i className="fa-solid fa-calendar-xmark" /> 週間対象外
                      </span>
                    )}
                  </div>
                )}
                <div className={styles.cardActions}>
                  <button
                    className={styles.rateBtn}
                    onClick={() => setRatingModal(key)}
                  >
                    <i className="fa-solid fa-star" />{' '}
                    {myRatings[key] ? '評価を変更' : '評価する'}
                  </button>
                  <button
                    className={styles.reviewBtn}
                    onClick={() => setReviewsModal(key)}
                  >
                    <i className="fa-solid fa-comments" /> レビュー
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formModal && (
        <ExerciseFormModal
          mode={formModal.mode}
          initial={
            formModal.mode === 'edit' ? freeExercises[formModal.key] : undefined
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
      {ratingModal && (
        <RatingModal
          exerciseKey={ratingModal}
          exerciseName={freeExercises[ratingModal]?.name || ''}
          userName={userData?.userName || user?.email || '匿名'}
          onClose={() => setRatingModal(null)}
          onChanged={() => setRatingsVersion((v) => v + 1)}
        />
      )}
      {reviewsModal && (
        <ReviewsModal
          exerciseKey={reviewsModal}
          exerciseName={freeExercises[reviewsModal]?.name || ''}
          onClose={() => setReviewsModal(null)}
        />
      )}
    </div>
  );
}
