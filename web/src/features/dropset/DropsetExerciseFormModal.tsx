import { useState } from 'react';
import Modal from '../../components/Modal';
import { ICON_CHOICES, PRESET_TAGS } from '../../lib/constants';
import {
  DEFAULT_START_WEIGHT,
  DEFAULT_STEP,
  MAX_STEP,
  MAX_WEIGHT,
  MIN_STEP,
  MIN_WEIGHT,
  TARGET_REPS,
  formatWeight,
} from '../../lib/dropset';
import type { DropsetExercise } from '../../lib/types';
import styles from '../exercises/ExerciseFormModal.module.css';
import ds from './DropsetExerciseFormModal.module.css';

export interface DropsetExerciseFormValue {
  name: string;
  rule: string;
  icon: string;
  tags: string[];
  startWeight: number;
  step: number;
}

export default function DropsetExerciseFormModal({
  mode,
  initial,
  onClose,
  onSubmit,
  onDelete,
  busy,
}: {
  mode: 'add' | 'edit';
  initial?: DropsetExercise;
  onClose: () => void;
  onSubmit: (v: DropsetExerciseFormValue) => void;
  onDelete?: () => void;
  busy?: boolean;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [rule, setRule] = useState(initial?.rule || '');
  const [icon, setIcon] = useState(initial?.icon || 'fa-dumbbell');
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [startWeight, setStartWeight] = useState(
    String(initial?.startWeight ?? DEFAULT_START_WEIGHT),
  );
  const [step, setStep] = useState(String(initial?.step ?? DEFAULT_STEP));
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

  const sw = Number(startWeight);
  const st = Number(step);
  const previewOk =
    isFinite(sw) && sw >= MIN_WEIGHT && isFinite(st) && st >= MIN_STEP;

  function submit() {
    if (name.trim().length < 1) {
      setErr('種目名を入力してください');
      return;
    }
    if (!isFinite(sw) || sw < MIN_WEIGHT || sw > MAX_WEIGHT) {
      setErr(`開始重量は ${MIN_WEIGHT}〜${MAX_WEIGHT}kg で入力してください`);
      return;
    }
    if (!isFinite(st) || st < MIN_STEP || st > MAX_STEP) {
      setErr(`刻み幅は ${MIN_STEP}〜${MAX_STEP}kg で入力してください`);
      return;
    }
    onSubmit({
      name: name.trim(),
      rule: rule.trim(),
      icon,
      tags,
      startWeight: sw,
      step: st,
    });
  }

  return (
    <Modal
      title={mode === 'add' ? '種目を追加' : '種目を編集'}
      icon={mode === 'add' ? 'fa-plus' : 'fa-pen-to-square'}
      onClose={onClose}
    >
      <div className={styles.form}>
        <p className={ds.lead}>
          <i className="fa-solid fa-circle-info" /> ドロップセット専用の種目です。
          週間チャレンジやデイリーミッションには選ばれません。
        </p>

        <label className={styles.label}>種目名</label>
        <input
          className="field"
          placeholder="例: ベンチプレス"
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
          placeholder="例: 尻を浮かせない。バーが胸に触れるまで下ろす。"
          maxLength={200}
          rows={3}
          value={rule}
          onChange={(e) => setRule(e.target.value)}
        />

        <label className={styles.label}>重量の設定</label>
        <div className={ds.numGrid}>
          <div className={ds.numField}>
            <span className={ds.numLabel}>開始重量</span>
            <div className={ds.numRow}>
              <input
                className="field"
                type="number"
                inputMode="decimal"
                step="0.5"
                min={MIN_WEIGHT}
                max={MAX_WEIGHT}
                value={startWeight}
                onChange={(e) => setStartWeight(e.target.value)}
              />
              <span className={ds.unit}>kg</span>
            </div>
          </div>
          <div className={ds.numField}>
            <span className={ds.numLabel}>刻み幅</span>
            <div className={ds.numRow}>
              <input
                className="field"
                type="number"
                inputMode="decimal"
                step="0.25"
                min={MIN_STEP}
                max={MAX_STEP}
                value={step}
                onChange={(e) => setStep(e.target.value)}
              />
              <span className={ds.unit}>kg</span>
            </div>
          </div>
        </div>
        <p className={styles.hint}>
          {previewOk
            ? `${formatWeight(sw)}kg から始まり、${TARGET_REPS.join('-')} をクリアするたびに ` +
              `${formatWeight(sw + st)}kg → ${formatWeight(sw + st * 2)}kg と上がります`
            : '開始重量と、クリアするたびに増える幅を決めます'}
        </p>
        <p className={styles.hint}>
          挑戦するときの重量は自由に書き換えられます。ここで決めるのは
          入力欄の初期値なので、人によってレベルが違っても大丈夫です。
        </p>

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
            onKeyDown={(e) =>
              e.key === 'Enter' && (e.preventDefault(), addFreeTag())
            }
          />
          <button className="btn-secondary" type="button" onClick={addFreeTag}>
            <i className="fa-solid fa-plus" />
          </button>
        </div>

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
