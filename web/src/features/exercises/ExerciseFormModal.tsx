import { useState } from 'react';
import Modal from '../../components/Modal';
import { ICON_CHOICES, PRESET_TAGS } from '../../lib/constants';
import type { FreeExercise } from '../../lib/types';
import styles from './ExerciseFormModal.module.css';

export interface ExerciseFormValue {
  name: string;
  rule: string;
  icon: string;
  tags: string[];
  barbarian: boolean;
  excludeFromWeekly: boolean;
}

export default function ExerciseFormModal({
  mode,
  initial,
  onClose,
  onSubmit,
  onDelete,
  busy,
}: {
  mode: 'add' | 'edit';
  initial?: FreeExercise;
  onClose: () => void;
  onSubmit: (v: ExerciseFormValue) => void;
  onDelete?: () => void;
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
  const [freeTag, setFreeTag] = useState('');
  const [err, setErr] = useState('');

  function toggleTag(t: string) {
    setTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }
  function addFreeTag() {
    const t = freeTag.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setFreeTag('');
  }

  function submit() {
    if (name.trim().length < 1) {
      setErr('種目名を入力してください');
      return;
    }
    onSubmit({
      name: name.trim(),
      rule: rule.trim(),
      icon,
      tags,
      barbarian,
      excludeFromWeekly,
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
        <div className={styles.tagChips}>
          {PRESET_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              className={tags.includes(t) ? styles.chipOn : styles.chip}
              onClick={() => toggleTag(t)}
            >
              {t}
            </button>
          ))}
          {tags
            .filter((t) => !PRESET_TAGS.includes(t))
            .map((t) => (
              <button
                key={t}
                type="button"
                className={styles.chipOn}
                onClick={() => toggleTag(t)}
              >
                {t} ✕
              </button>
            ))}
        </div>
        <div className={styles.freeTagRow}>
          <input
            className="field"
            placeholder="フリータグを入力"
            maxLength={10}
            value={freeTag}
            onChange={(e) => setFreeTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFreeTag())}
          />
          <button className="btn-secondary" type="button" onClick={addFreeTag}>
            <i className="fa-solid fa-plus" />
          </button>
        </div>

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
        {mode === 'edit' && onDelete && (
          <button className="btn-danger" disabled={busy} onClick={onDelete}>
            <i className="fa-solid fa-trash" /> 種目を削除
          </button>
        )}
      </div>
    </Modal>
  );
}
