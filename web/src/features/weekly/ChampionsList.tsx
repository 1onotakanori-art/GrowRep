import { useEffect, useState } from 'react';
import { useData } from '../../context/DataContext';
import { loadChampionsHistory, type ChampionDoc } from '../../lib/weekly-engine';
import { Skeleton, EmptyState } from '../../components/ui';
import Modal from '../../components/Modal';
import styles from './ChampionsList.module.css';

interface Top5Entry {
  rank: number;
  userId: string;
  userName: string;
  value: number;
  percent: number;
  champion?: boolean;
}
interface ExDetail {
  name: string;
  maxValue: number;
  barbarian?: boolean;
  top5: Top5Entry[];
}

export default function ChampionsList() {
  const { freeExercises } = useData();
  const [champs, setChamps] = useState<ChampionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{
    champ: ChampionDoc;
    exerciseKey: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setChamps(await loadChampionsHistory());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Skeleton count={3} />;
  if (champs.length === 0)
    return (
      <EmptyState icon="fa-crown" message="確定した歴代チャンプはまだいません" />
    );

  return (
    <div className={styles.list}>
      {champs.map((c) => (
        <div key={c.id} className={styles.card}>
          <div className={styles.head}>
            <span className={styles.week}>
              <i className="fa-solid fa-crown" /> 第{c.weekNumber}週チャンプ
            </span>
            <span className={styles.period}>{c.periodLabel}</span>
          </div>
          <div className={styles.champUser}>
            <span className={styles.crown}>👑</span>
            <span className={styles.name}>{c.champUserName}</span>
            <span className={styles.score}>
              {Math.round(c.champTotalScore)}pt
            </span>
          </div>
          {c.predictionResults &&
            c.predictionResults.correctUserIds.length > 0 && (
              <div className={styles.predHit}>
                <i className="fa-solid fa-bullseye" /> 予想的中:{' '}
                {c.predictionResults.correctUserIds.length}人
              </div>
            )}
          <div className={styles.exercises}>
            {Object.entries(c.exercises || {}).map(([key, ex]) => {
              const isB = !!freeExercises[key]?.barbarian;
              return (
                <button
                  key={key}
                  className={styles.exBtn}
                  onClick={() => setDetail({ champ: c, exerciseKey: key })}
                >
                  <i
                    className={`fa-solid ${isB ? 'fa-stopwatch' : 'fa-dumbbell'}`}
                  />
                  {ex.name}:{' '}
                  <strong>
                    {Math.round(ex.value)}
                    {isB ? '秒' : ''}
                  </strong>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {detail && (
        <ChampionDetailModal
          detail={
            (detail.champ.exerciseTop5?.[detail.exerciseKey] as ExDetail) || null
          }
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function ChampionDetailModal({
  detail,
  onClose,
}: {
  detail: ExDetail | null;
  onClose: () => void;
}) {
  if (!detail) {
    return (
      <Modal title="種目詳細" icon="fa-crown" onClose={onClose}>
        <EmptyState icon="fa-circle-info" message="詳細データがありません" />
      </Modal>
    );
  }
  const isB = !!detail.barbarian;
  return (
    <Modal title={detail.name} icon="fa-crown" onClose={onClose}>
      <div className={styles.detailList}>
        {detail.top5.map((e) => (
          <div
            key={e.userId}
            className={`${styles.detailRow} ${e.rank === 1 ? styles.detailTop : ''}`}
          >
            <span className={styles.detailRank}>
              {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : e.rank}
            </span>
            <span className={styles.detailName}>{e.userName}</span>
            <span className={styles.detailVal}>
              {e.value}
              {isB ? '秒' : ''}
            </span>
            <span className={styles.detailPct}>{e.percent.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
