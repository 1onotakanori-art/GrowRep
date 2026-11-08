import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useMode } from '../context/ModeContext';
import { useToast } from '../context/ToastContext';
import {
  ViewHeader,
  EmptyState,
  StarRating,
  Barbadge,
  Segmented,
  Skeleton,
} from '../components/ui';
import ExerciseFormModal, {
  type ExerciseFormValue,
} from '../features/exercises/ExerciseFormModal';
import RatingModal from '../features/exercises/RatingModal';
import ReviewsModal from '../features/exercises/ReviewsModal';
import ExerciseDashboard from '../features/exercises/ExerciseDashboard';
import { addFreeExercise, editFreeExercise } from '../lib/exercises';
import ArchivePanel from '../features/exercises/ArchivePanel';
import {
  archiveBlockReason,
  findOrphanExercises,
  type Archived,
} from '../lib/exercise-archive';
import {
  archiveExercise,
  loadArchivedExercises,
  restoreArchivedExercise,
  restoreOrphanExercise,
} from '../lib/exercise-archive-engine';
import {
  getExerciseRatingSummaries,
  getUserExerciseRatings,
} from '../lib/ratings';
import {
  EMPTY_EXERCISE_FILTER,
  collectExerciseTags,
  filterExercises,
  type ExerciseFilter,
} from '../lib/exercise-filter';
import ExerciseSearchBar from '../components/ExerciseSearchBar';
import { favoritesFirst } from '../lib/favorites';
import { sortTagsByCatalog } from '../lib/tag-catalog';
import { useFavorites } from '../hooks/useFavorites';
import {
  estimateSelectionProbabilities,
  formatProb,
  type SelectionEstimate,
} from '../lib/exercise-insights';
import {
  loadInsightsData,
  type InsightsData,
} from '../lib/exercise-insights-engine';
import type { ExerciseRatingSummary, FreeExercise } from '../lib/types';
import styles from './ExercisesView.module.css';

type Sort = 'name' | 'rating' | 'new' | 'posts' | 'wc' | 'prob';
type Tab = 'list' | 'dashboard' | 'archive';

export default function ExercisesView({
  focusKey = null,
  onFocusDone,
  onBack,
}: {
  /** 「種目詳細」から来たとき、表示してハイライトする種目 */
  focusKey?: string | null;
  /** focusKey の種目までスクロールし終えたら呼ぶ（親が focusKey を消す） */
  onFocusDone?: () => void;
  /** サブページとして開いたときの戻る（フリー以外のモード） */
  onBack?: () => void;
} = {}) {
  const { user, userData } = useAuth();
  const { refresh, refreshToken } = useMode();
  const {
    freeExercises,
    setFreeExercises,
    usersMap,
    reloadExercises,
    dailyMission,
    tagCatalog,
    addTagsToCatalog,
  } = useData();
  const { favorites, canFavorite, toggle: toggleFavorite } = useFavorites();
  const { toast } = useToast();

  const [summaries, setSummaries] = useState<Record<string, ExerciseRatingSummary>>({});
  const [myRatings, setMyRatings] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<ExerciseFilter>(EMPTY_EXERCISE_FILTER);
  const [sort, setSort] = useState<Sort>('name');
  const [ratingsVersion, setRatingsVersion] = useState(0);
  const [tab, setTab] = useState<Tab>('list');
  // 投稿数・選出回数・選出確率（旧 exercises.html のダッシュボード）
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [insightsError, setInsightsError] = useState(false);
  const [ratingsReady, setRatingsReady] = useState(false);
  const [estimates, setEstimates] = useState<Record<string, SelectionEstimate>>({});

  const [formModal, setFormModal] = useState<
    { mode: 'add' } | { mode: 'edit'; key: string } | null
  >(null);
  const [ratingModal, setRatingModal] = useState<string | null>(null);
  const [reviewsModal, setReviewsModal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  // アーカイブ（null = 未読み込み）。タブを開いた時に読む
  const [archive, setArchive] = useState<Record<string, Archived<FreeExercise>> | null>(null);
  const [archiveBusyKey, setArchiveBusyKey] = useState<string | null>(null);

  const keys = useMemo(() => Object.keys(freeExercises), [freeExercises]);

  useEffect(() => {
    (async () => {
      if (keys.length === 0) return;
      const [sum, mine] = await Promise.all([
        getExerciseRatingSummaries(keys),
        getUserExerciseRatings(keys),
      ]);
      setSummaries(sum);
      setRatingsReady(true);
      const mineMap: Record<string, boolean> = {};
      Object.keys(mine).forEach((k) => (mineMap[k] = true));
      setMyRatings(mineMap);
    })();
  }, [keys, ratingsVersion]);

  useEffect(() => {
    let alive = true;
    setInsightsError(false);
    loadInsightsData()
      .then((d) => alive && setInsights(d))
      .catch((e) => {
        console.error('[種目まとめ] 読み込み失敗:', e);
        if (alive) setInsightsError(true);
      });
    return () => {
      alive = false;
    };
  }, [refreshToken]);

  // 本番と同じ抽選を数千回まわす（数百ms）。評価がそろってから1回だけ、
  // 一覧を先に描いた後で計算する（setTimeout で描画を待たせない）
  useEffect(() => {
    if (!insights || !ratingsReady) return;
    const id = window.setTimeout(() => {
      setEstimates(
        estimateSelectionProbabilities({
          exercises: freeExercises,
          history: insights.history,
          creatorHistory: insights.creatorHistory,
          excludeKeys: insights.currentWeekKeys,
          ratings: summaries,
          creators: usersMap,
          config: insights.config,
        }),
      );
    }, 0);
    return () => window.clearTimeout(id);
  }, [insights, ratingsReady, freeExercises, summaries, usersMap]);
  const estimatesReady = Object.keys(estimates).length > 0;

  useEffect(() => {
    if (tab !== 'archive' || archive !== null) return;
    loadArchivedExercises<FreeExercise>('settings_free')
      .then(setArchive)
      .catch((e) => {
        console.error('[アーカイブ] 読み込み失敗:', e);
        setArchive({});
        toast('アーカイブの読み込みに失敗しました', 'error');
      });
  }, [tab, archive, toast]);

  const orphans = useMemo(
    () =>
      insights && archive
        ? findOrphanExercises(
            Object.fromEntries(
              Object.entries(insights.postStats).map(([k, v]) => [k, v.total]),
            ),
            freeExercises,
            archive,
          )
        : [],
    [insights, archive, freeExercises],
  );

  const actor = () => ({
    uid: user!.uid,
    name: userData?.userName || user?.email || 'Unknown',
  });

  const allTags = useMemo(
    () => collectExerciseTags(Object.values(freeExercises)),
    [freeExercises],
  );

  const list = useMemo(() => {
    const entries = filterExercises(
      Object.entries(freeExercises),
      ([, ex]) => ex,
      filter,
    );
    entries.sort(([ka, a], [kb, b]) => {
      if (sort === 'rating') {
        return (summaries[kb]?.avgRating || 0) - (summaries[ka]?.avgRating || 0);
      }
      if (sort === 'new') {
        return kb.localeCompare(ka); // key に timestamp を含むため擬似的に新しい順
      }
      if (sort === 'posts') {
        return (
          (insights?.postStats[kb]?.total || 0) -
          (insights?.postStats[ka]?.total || 0)
        );
      }
      if (sort === 'wc') {
        return (insights?.history[kb] || 0) - (insights?.history[ka] || 0);
      }
      if (sort === 'prob') {
        return (estimates[kb]?.prob || 0) - (estimates[ka]?.prob || 0);
      }
      return a.name.localeCompare(b.name, 'ja');
    });
    // どの並び順でもお気に入りが先頭（お気に入り同士・それ以外は選んだ順のまま）
    return favoritesFirst(entries, ([k]) => k, favorites);
  }, [freeExercises, filter, sort, summaries, insights, estimates, favorites]);

  // 「種目詳細」から来たら、絞り込みを外して一覧タブを出す
  useEffect(() => {
    if (!focusKey) return;
    setTab('list');
    setFilter(EMPTY_EXERCISE_FILTER);
  }, [focusKey]);

  // 一覧に該当カードが描かれたらスクロールして少しの間ハイライトする
  useEffect(() => {
    if (!focusKey || tab !== 'list') return;
    if (!list.some(([k]) => k === focusKey)) return; // 種目の読み込み待ち
    document
      .getElementById(`exercise-${focusKey}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightKey(focusKey);
    onFocusDone?.();
  }, [focusKey, tab, list, onFocusDone]);

  useEffect(() => {
    if (!highlightKey) return;
    const id = window.setTimeout(() => setHighlightKey(null), 2400);
    return () => window.clearTimeout(id);
  }, [highlightKey]);

  async function handleFormSubmit(v: ExerciseFormValue) {
    if (!formModal) return;
    setBusy(true);
    try {
      // 新しく作ったタグを先に属性へ登録する（種目だけ保存されて属性が無い状態を避ける）
      await addTagsToCatalog(v.newTags);
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

  async function handleArchive(key: string) {
    const name = freeExercises[key]?.name;
    if (
      !confirm(
        `種目「${name}」をアーカイブしますか？\n\n一覧・週間チャレンジの抽選・デイリーミッションから外れます。これまでの記録は残り、「アーカイブ」タブからいつでも戻せます。`,
      )
    )
      return;
    setBusy(true);
    try {
      await archiveExercise('settings_free', key, actor());
      await reloadExercises();
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
      await restoreArchivedExercise('settings_free', key);
      await reloadExercises();
      setArchive(await loadArchivedExercises<FreeExercise>('settings_free'));
      toast(`「${name}」を戻しました`, 'success');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : '戻せませんでした', 'error');
    } finally {
      setArchiveBusyKey(null);
    }
  }

  async function handleRestoreOrphan(key: string, name: string) {
    setArchiveBusyKey(key);
    try {
      await restoreOrphanExercise(key, name, actor());
      await reloadExercises();
      toast(`「${name}」として戻しました`, 'success');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : '戻せませんでした', 'error');
    } finally {
      setArchiveBusyKey(null);
    }
  }

  return (
    <div className="fade-in">
      <ViewHeader
        icon="fa-dumbbell"
        title="種目 & ルール"
        action={
          <div className={styles.headActions}>
            {onBack && (
              <button className={styles.backBtn} onClick={onBack}>
                <i className="fa-solid fa-arrow-left" /> 戻る
              </button>
            )}
            <button
              className={styles.addBtn}
              onClick={() => setFormModal({ mode: 'add' })}
            >
              <i className="fa-solid fa-plus" /> 追加
            </button>
          </div>
        }
      />

      <Segmented<Tab>
        options={[
          { value: 'list', label: '種目一覧' },
          { value: 'dashboard', label: 'ダッシュボード' },
          { value: 'archive', label: 'アーカイブ' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'dashboard' &&
        (insights ? (
          <ExerciseDashboard
            exercises={freeExercises}
            postStats={insights.postStats}
            ratings={summaries}
            estimates={estimates}
            history={insights.history}
          />
        ) : insightsError ? (
          <EmptyState icon="fa-triangle-exclamation" message="読み込みに失敗しました" />
        ) : (
          <Skeleton count={4} />
        ))}

      {tab === 'archive' && (
        <ArchivePanel
          archive={archive}
          postCounts={
            insights
              ? Object.fromEntries(
                  Object.entries(insights.postStats).map(([k, v]) => [k, v.total]),
                )
              : undefined
          }
          busyKey={archiveBusyKey}
          onRestore={handleRestore}
          orphans={orphans}
          onRestoreOrphan={handleRestoreOrphan}
        />
      )}

      {tab === 'list' && (
        <>
          <ExerciseSearchBar
            value={filter}
            onChange={setFilter}
            tags={allTags}
            resultCount={list.length}
            searchExtra={
              <select
                className={styles.sortSel}
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="並び順"
              >
                <option value="name">名前順</option>
                <option value="rating">評価順</option>
                <option value="new">新着順</option>
                <option value="posts" disabled={!insights}>
                  投稿数順
                </option>
                <option value="wc" disabled={!insights}>
                  週チャレ回数順
                </option>
                <option value="prob" disabled={!estimatesReady}>
                  選出確率順
                </option>
              </select>
            }
          />

          {list.length === 0 ? (
            <EmptyState icon="fa-dumbbell" message="種目がありません" />
          ) : (
            <div className={styles.list}>
              {list.map(([key, ex]) => {
                const sum = summaries[key];
                const isMine =
                  (ex as FreeExercise).createdBy === user?.uid;
                const inThisWeek = !!insights?.currentWeekKeys.includes(key);
                const fav = favorites.has(key);
                return (
                  <div
                    key={key}
                    id={`exercise-${key}`}
                    className={[
                      styles.card,
                      fav && styles.cardFav,
                      highlightKey === key && styles.cardFocus,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
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
                      {canFavorite ? (
                        <button
                          className={fav ? styles.favBtnOn : styles.favBtn}
                          onClick={() => toggleFavorite(key)}
                          aria-pressed={fav}
                          aria-label={fav ? 'お気に入りから外す' : 'お気に入りに追加'}
                          title={fav ? 'お気に入りから外す' : 'お気に入りに追加'}
                        >
                          <i className={`fa-${fav ? 'solid' : 'regular'} fa-bookmark`} />
                        </button>
                      ) : null}
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
                    {((ex.tags || []).length > 0 ||
                      ex.excludeFromWeekly ||
                      ex.excludeFromDaily ||
                      inThisWeek) && (
                      <div className={styles.cardTags}>
                        {inThisWeek && (
                          <span className={styles.weekChip}>
                            <i className="fa-solid fa-bolt" /> 今週のチャレンジ
                          </span>
                        )}
                        {sortTagsByCatalog(tagCatalog, ex.tags || []).map((t) => (
                          <span key={t} className="chip">
                            {t}
                          </span>
                        ))}
                        {ex.excludeFromWeekly && (
                          <span className={styles.exclChip}>
                            <i className="fa-solid fa-calendar-xmark" /> 週間対象外
                          </span>
                        )}
                        {ex.excludeFromDaily && (
                          <span className={styles.exclChip}>
                            <i className="fa-solid fa-bullseye" /> デイリー対象外
                          </span>
                        )}
                      </div>
                    )}
                    {insights && (
                      <div className={styles.stats}>
                        <span title="投稿数">
                          <i className="fa-solid fa-pen" /> 投稿{' '}
                          {insights.postStats[key]?.total || 0}
                        </span>
                        <span title="週間チャレンジに選ばれた回数">
                          <i className="fa-solid fa-bolt" /> 週チャレ{' '}
                          {insights.history[key] || 0}回
                        </span>
                        <span title="次の週間チャレンジで選ばれる確率（推定）">
                          <i className="fa-solid fa-dice" /> 次の選出{' '}
                          {ex.excludeFromWeekly
                            ? '対象外'
                            : estimatesReady
                              ? formatProb(estimates[key]?.prob || 0)
                              : '計算中…'}
                        </span>
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
        </>
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
          onArchive={
            formModal.mode === 'edit'
              ? () => handleArchive(formModal.key)
              : undefined
          }
          archiveBlocked={
            formModal.mode === 'edit'
              ? archiveBlockReason(formModal.key, {
                  weeklyKeys: insights?.currentWeekKeys,
                  dailyKey: dailyMission?.exerciseKey,
                })
              : null
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
