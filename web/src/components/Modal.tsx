import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

export default function Modal({
  title,
  icon,
  onClose,
  children,
  maxWidth,
  dismissible = true,
}: {
  title: ReactNode;
  icon?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
  /**
   * false にすると ✕ / Escape / 背景タップで閉じられなくなる。
   * 回答するまで閉じさせたくない通知（特別イベントの承認依頼）で使う。
   */
  dismissible?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dismissible && e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, dismissible]);

  // ⚠️ 必ず body 直下へポータルする。
  // ビュー側は `.fade-in`（transform を animate する）の中でモーダルを描画するが、
  // transform を持つ祖先は position:fixed の包含ブロックになる。その結果
  // オーバーレイがビューポートではなくリスト全体の高さに広がり、
  // シートが画面外（リスト末尾）へ飛んで「背景だけ暗くなって何も出ない」状態になる。
  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={dismissible ? onClose : undefined}
    >
      <div
        className={styles.sheet}
        style={maxWidth ? { maxWidth } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.head}>
          <h2 className={styles.title}>
            {icon && <i className={`fa-solid ${icon}`} />} {title}
          </h2>
          {dismissible && (
            <button
              className={styles.close}
              onClick={onClose}
              aria-label="閉じる"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
