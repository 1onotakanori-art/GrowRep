import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { getExerciseReviews, type Review } from '../../lib/ratings';
import { Skeleton, EmptyState } from '../../components/ui';
import styles from './ReviewsModal.module.css';

export default function ReviewsModal({
  exerciseKey,
  exerciseName,
  onClose,
}: {
  exerciseKey: string;
  exerciseName: string;
  onClose: () => void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setReviews(await getExerciseReviews(exerciseKey));
      setLoading(false);
    })();
  }, [exerciseKey]);

  return (
    <Modal title="みんなの評価" icon="fa-comments" onClose={onClose}>
      <p className={styles.exName}>{exerciseName}</p>
      {loading ? (
        <Skeleton count={3} />
      ) : reviews.length === 0 ? (
        <EmptyState icon="fa-comment-slash" message="まだ評価がありません" />
      ) : (
        <div className={styles.list}>
          {reviews.map((r) => (
            <div key={r.id} className={styles.item}>
              <div className={styles.head}>
                <span className={styles.user}>{r.userName || '匿名'}</span>
                <span className={styles.stars}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <i
                      key={i}
                      className={`fa-${i < (r.rating || 0) ? 'solid' : 'regular'} fa-star`}
                    />
                  ))}
                </span>
              </div>
              {r.comment && <p className={styles.comment}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
