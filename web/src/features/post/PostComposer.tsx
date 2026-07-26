import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useMode } from '../../context/ModeContext';
import { useToast } from '../../context/ToastContext';
import { submitPost } from '../../lib/posts';
import { getModeExercises } from '../../lib/mode-exercises';
import { EmptyState, ExerciseIcon, Barbadge } from '../../components/ui';
import styles from './PostComposer.module.css';

export default function PostComposer() {
  const { user } = useAuth();
  const { mode, refresh } = useMode();
  const { freeExercises, weeklyChallenge } = useData();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const exercises = useMemo(
    () => getModeExercises(mode, freeExercises, weeklyChallenge),
    [mode, freeExercises, weeklyChallenge],
  );

  async function handleSubmit(key: string) {
    if (!user) return;
    const num = parseInt(value, 10);
    if (!num || num <= 0 || isNaN(num) || num > 10000) {
      toast('回数または秒数を正しく入力してください（1〜10000）', 'error');
      return;
    }
    setBusy(true);
    try {
      await submitPost(user, key, num);
      toast('投稿しました！', 'success');
      setSelected(null);
      setValue('');
      refresh();
    } catch {
      toast('投稿に失敗しました', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'weekly' && exercises.length === 0) {
    return (
      <EmptyState
        icon="fa-hourglass-half"
        message="今週のチャレンジ種目を準備中です"
      />
    );
  }
  if (mode === 'free' && exercises.length === 0) {
    return (
      <EmptyState
        icon="fa-dumbbell"
        message="種目がまだありません。「種目」タブから追加できます"
      />
    );
  }

  return (
    <div className={styles.grid}>
      {exercises.map(({ key, ex, locked }) => {
        if (locked) {
          return (
            <div key={key} className={styles.locked}>
              <span className={styles.lockIcon}>
                <i className="fa-solid fa-lock" />
              </span>
              <span className={styles.lockName}>？？？</span>
              <span className={styles.lockNote}>水曜13:00 解禁</span>
            </div>
          );
        }
        const open = selected === key;
        return (
          <div
            key={key}
            className={`${styles.card} ${open ? styles.cardOpen : ''}`}
          >
            <button
              className={styles.cardHead}
              onClick={() => {
                setSelected(open ? null : key);
                setValue('');
              }}
            >
              <span className={styles.icon}>
                <ExerciseIcon icon={ex.icon} />
              </span>
              <span className={styles.name}>{ex.name}</span>
              {ex.barbarian && <Barbadge />}
              <i
                className={`fa-solid fa-chevron-${open ? 'up' : 'down'} ${styles.chev}`}
              />
            </button>
            {ex.rule && !open && (
              <p className={styles.rule}>{ex.rule}</p>
            )}
            {open && (
              <div className={styles.form}>
                {ex.rule && <p className={styles.ruleOpen}>{ex.rule}</p>}
                <div className={styles.inputRow}>
                  <input
                    className="field"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10000}
                    placeholder={ex.barbarian ? '秒数' : '回数'}
                    value={value}
                    autoFocus
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit(key)}
                  />
                  <span className={styles.unit}>
                    {ex.barbarian ? '秒' : '回'}
                  </span>
                  <button
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => handleSubmit(key)}
                  >
                    {busy ? (
                      <i className="fa-solid fa-circle-notch spin" />
                    ) : (
                      '投稿'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
