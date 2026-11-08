import { useState } from 'react';
import Modal from '../../components/Modal';
import { ICON_CHOICES } from '../../lib/constants';
import TagPicker from '../../components/TagPicker';
import { useData } from '../../context/DataContext';
import type { TagAddition } from '../../lib/tag-catalog';
import { DROPSET_TAG, withoutDropsetTag } from '../../lib/dropset';
import type { FreeExercise } from '../../lib/types';
import styles from './ExerciseFormModal.module.css';

export interface ExerciseFormValue {
  name: string;
  rule: string;
  icon: string;
  tags: string[];
  /** このフォームで新しく作ったタグ。保存前に属性カタログへ登録する */
  newTags: TagAddition[];
  barbarian: boolean;
  excludeFromWeekly: boolean;
  excludeFromDaily: boolean;
}

export default function ExerciseFormModal({
  mode,
  initial,
  onClose,
  onSubmit,
  onArchive,
  archiveBlocked,
  busy,
}: {
  mode: 'add' | 'edit';
  initial?: FreeExercise;
  onClose: () => void;
  onSubmit: (v: ExerciseFormValue) => void;
  /** 種目のアーカイブ（削除はしない）。編集時のみ */
  onArchive?: () => void;
  /** アーカイブできない理由（今週のチャレンジで使用中など）。あればボタンを止める */
  archiveBlocked?: string | null;
  busy?: boolean;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [rule, setRule] = useState(initial?.rule || '');
  const [icon, setIcon] = useState(initial?.icon || 'fa-dumbbell');
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [barbarian, setBarbarian] = useState(!!initial?.barbarian);
  const [excludeFromWeekly, setExclude] = useState(
    !!initial?.excludeFromWeekly,
  );
  const [excludeFromDaily, setExcludeDaily] = useState(
    !!initial?.excludeFromDaily,
  );
  const [newTags, setNewTags] = useState<TagAddition[]>([]);
  const { tagCatalog } = useData();
  const [err, setErr] = useState('');


  function submit() {
    if (name.trim().length < 1) {
      setErr('種目名を入力してください');
      return;
    }
    onSubmit({
      name: name.trim(),
      rule: rule.trim(),
      icon,
      // ドロップセット専用タグはフリー種目に付けない
      tags: withoutDropsetTag(tags),
      newTags: newTags.filter((n) => tags.includes(n.tag)),
      barbarian,
      excludeFromWeekly,
      excludeFromDaily,
    });
  }

  return (
    <Modal
      title={mode === 'add' ? '種目を追加' : '種目を編集'}
      icon={mode === 'add' ? 'fa-plus' : 'fa-pen-to-square'}
      onClose={onClose}
    >
      <div className={styles.form}>
        <label className={styles.label}>種目名</label>
        <input
          className="field"
          placeholder="例: バーピー"
          maxLength={20}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className={styles.label}>アイコン</label>
        <div className={styles.iconGrid}>
          {ICON_CHOICES.map((ic, i) => (
            <button
              key={`${ic}-${i}`}
              className={ic === icon ? styles.iconOn : styles.iconBtn}
              onClick={() => setIcon(ic)}
              type="button"
            >
              <i className={`fa-solid ${ic}`} />
            </button>
          ))}
        </div>

        <label className={styles.label}>ルール説明</label>
        <textarea
          className="field"
          placeholder="例: 1分間で行った回数を記録"
          maxLength={200}
          rows={3}
          value={rule}
          onChange={(e) => setRule(e.target.value)}
        />

        <label className={styles.label}>タグ</label>
        <TagPicker
          catalog={tagCatalog}
          value={tags}
          onChange={setTags}
          newTags={newTags}
          onNewTagsChange={setNewTags}
          hiddenTags={[DROPSET_TAG]}
        />

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={barbarian}
            onChange={(e) => setBarbarian(e.target.checked)}
          />
          <span>
            <i className="fa-solid fa-stopwatch" /> バーバリアン方式（タイムアタック）
          </span>
        </label>
        <p className={styles.hint}>ONにすると、短い秒数ほど高得点になります</p>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={excludeFromWeekly}
            onChange={(e) => setExclude(e.target.checked)}
          />
          <span>
            <i className="fa-solid fa-calendar-xmark" /> 週間チャレンジ選出しない
          </span>
        </label>

        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={excludeFromDaily}
            onChange={(e) => setExcludeDaily(e.target.checked)}
          />
          <span>
            <i className="fa-solid fa-bullseye" /> デイリーミッション選出しない
          </span>
        </label>

        {err && <p className={styles.err}>{err}</p>}

        <button className="btn-primary" disabled={busy} onClick={submit}>
          {busy ? (
            <i className="fa-solid fa-circle-notch spin" />
          ) : mode === 'add' ? (
            '追加する'
          ) : (
            '保存する'
          )}
        </button>
        {mode === 'edit' && onArchive && (
          <>
            <button
              className="btn-secondary"
              disabled={busy || !!archiveBlocked}
              onClick={onArchive}
            >
              <i className="fa-solid fa-box-archive" /> 種目をアーカイブ
            </button>
            <p className={styles.hint}>
              {archiveBlocked ||
                'アーカイブすると一覧や抽選から外れます。記録は残り、いつでも戻せます。'}
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
