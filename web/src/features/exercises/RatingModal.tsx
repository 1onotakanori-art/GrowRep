import { useEffect, useState } from 'react';
import Modal from '../../components/Modal';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import {
  submitExerciseRating,
  deleteExerciseRating,
  getUserExerciseRatings,
} from '../../lib/ratings';
import styles from './RatingModal.module.css';

const LABELS = [
  '2度とやりたくない',
  '不良種目',
  '悪くない',
  '良種目',
  'ぜひまたやりたい',
];

export default function RatingModal({
  exerciseKey,
  exerciseName,
  userName,
  onClose,
  onChanged,
}: {
  exerciseKey: string;
  exerciseName: string;
  userName: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { freeExercises } = useData();
  const { toast } = useToast();
  const [value, setValue] = useState(0);
  const [comment, setComment] = useState('');
  const [hasExisting, setHasExisting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const map = await getUserExerciseRatings([exerciseKey]);
      const mine = map[exerciseKey];
      if (mine) {
        setValue(mine.rating || 0);
        setComment(mine.comment || '');
        setHasExisting(true);
      }
    })();
  }, [exerciseKey]);

  async function submit() {
    if (value < 1) {
      toast('評価を選んでください', 'error');
      return;
    }
    setBusy(true);
    try {
      await submitExerciseRating(
        exerciseKey,
        value,
        comment,
        userName,
        freeExercises,
      );
      toast('評価を送信しました', 'success');
      onChanged();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : '送信に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('自分の評価を削除しますか？')) return;
    setBusy(true);
    try {
      await deleteExerciseRating(exerciseKey, freeExercises);
      toast('評価を削除しました', 'success');
      onChanged();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : '削除に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="種目を評価する" icon="fa-star" onClose={onClose}>
      <p className={styles.exName}>{exerciseName}</p>
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            className={v <= value ? styles.starOn : styles.star}
            onClick={() => setValue(v)}
            title={LABELS[v - 1]}
          >
            <i className="fa-solid fa-star" />
          </button>
        ))}
      </div>
      <p className={styles.label}>{value > 0 ? LABELS[value - 1] : '（未選択）'}</p>

      <label className={styles.commentLabel}>コメント（任意）</label>
      <textarea
        className="field"
        rows={3}
        maxLength={200}
        placeholder="種目についてのコメント…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <p className={styles.count}>{comment.length}/200</p>

      <button className="btn-primary" disabled={busy} onClick={submit}>
        <i className="fa-solid fa-paper-plane" /> 評価を送信
      </button>
      {hasExisting && (
        <button
          className={styles.deleteBtn}
          disabled={busy}
          onClick={remove}
        >
          評価を削除
        </button>
      )}
    </Modal>
  );
}
