import { useMemo, useState } from 'react';
import {
  addTagsToCatalog,
  categoryIdOfTag,
  groupTags,
  OTHER_CATEGORY_ID,
  type TagAddition,
  type TagCatalog,
} from '../lib/tag-catalog';
import styles from './TagPicker.module.css';

/**
 * 種目の追加・編集フォームのタグ欄。属性ごとにタグを並べて選ぶ。
 * 新しいタグは属性を選んで足す（保存時に settings_free/tag_catalog へ登録される）。
 * どの属性にも無いタグ（旧版のフリータグ）は「その他」に出し、外すこともできる。
 */
export default function TagPicker({
  catalog,
  value,
  onChange,
  newTags,
  onNewTagsChange,
  hiddenTags = [],
  hiddenCategories = [],
}: {
  catalog: TagCatalog;
  value: string[];
  onChange: (tags: string[]) => void;
  /** このフォームで新しく作ったタグ（保存時にカタログへ登録する） */
  newTags: TagAddition[];
  onNewTagsChange: (v: TagAddition[]) => void;
  /** 出さない・付けさせないタグ（フリーの '10-8-6' など）。value に入っていても表示しない */
  hiddenTags?: string[];
  /** 出さない・選ばせない属性（ドロップセットの「形式」など） */
  hiddenCategories?: string[];
}) {
  const selectable = catalog.categories.filter((c) => !hiddenCategories.includes(c.id));
  const [input, setInput] = useState('');
  const [categoryId, setCategoryId] = useState(selectable[0]?.id || '');
  const [note, setNote] = useState('');

  // 新しいタグも、選んだ属性の中に並べて見せる
  const shown = useMemo(() => addTagsToCatalog(catalog, newTags), [catalog, newTags]);
  const groups = useMemo(
    () =>
      groupTags(shown, [...shown.categories.flatMap((c) => c.tags), ...value], {
        includeEmpty: true,
      })
        .filter((g) => !hiddenCategories.includes(g.id))
        .map((g) => ({ ...g, tags: g.tags.filter((t) => !hiddenTags.includes(t)) }))
        .filter((g) => g.id !== OTHER_CATEGORY_ID || g.tags.length > 0),
    [shown, value, hiddenTags, hiddenCategories],
  );

  function toggle(t: string) {
    if (value.includes(t)) {
      onChange(value.filter((x) => x !== t));
      // 作ったばかりのタグを外したら、登録もやめる
      if (newTags.some((n) => n.tag === t)) onNewTagsChange(newTags.filter((n) => n.tag !== t));
    } else {
      onChange([...value, t]);
    }
  }

  function add() {
    const t = input.trim();
    if (!t) return;
    setInput('');
    const existing = categoryIdOfTag(shown, t);
    if (hiddenTags.includes(t) || hiddenCategories.includes(existing)) {
      setNote(`「${t}」はここでは付けられないタグです`);
      return;
    }
    if (existing !== OTHER_CATEGORY_ID) {
      const label = shown.categories.find((c) => c.id === existing)?.label;
      setNote(`「${t}」は「${label}」にあるタグです`);
      if (!value.includes(t)) onChange([...value, t]);
      return;
    }
    setNote('');
    onNewTagsChange([...newTags, { tag: t, categoryId }]);
    if (!value.includes(t)) onChange([...value, t]);
  }

  return (
    <div className={styles.wrap}>
      {groups.map((g) => (
        <div key={g.id} className={styles.group}>
          <span className={styles.groupLabel}>{g.label}</span>
          <div className={styles.chips}>
            {g.tags.length === 0 && <span className={styles.empty}>なし</span>}
            {g.tags.map((t) => {
              const on = value.includes(t);
              const isNew = newTags.some((n) => n.tag === t);
              return (
                <button
                  key={t}
                  type="button"
                  className={on ? styles.chipOn : styles.chip}
                  aria-pressed={on}
                  onClick={() => toggle(t)}
                >
                  {t}
                  {isNew && <span className={styles.newMark}>新</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {groups.some((g) => g.id === OTHER_CATEGORY_ID) && (
        <p className={styles.hint}>
          「その他」は属性の決まっていないタグです。下の欄で属性を選んで同じ名前で足すと、その属性に入ります。
        </p>
      )}

      <div className={styles.addRow}>
        <select
          className={`field ${styles.catSel}`}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="新しいタグの属性"
        >
          {selectable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          className="field"
          placeholder="新しいタグ"
          maxLength={10}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <button className="btn-secondary" type="button" onClick={add} aria-label="タグを追加">
          <i className="fa-solid fa-plus" />
        </button>
      </div>
      {note && <p className={styles.hint}>{note}</p>}
    </div>
  );
}
