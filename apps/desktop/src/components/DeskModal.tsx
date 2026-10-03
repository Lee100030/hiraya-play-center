import { Button } from '@hiraya/ui';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function DeskModal({
  title,
  children,
  onClose,
  tone = 'info',
  size = 'narrow',
  stacked,
  actions,
  hideFooter,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  tone?: 'info' | 'error' | 'success';
  size?: 'narrow' | 'wide' | 'board';
  stacked?: boolean;
  actions?: ReactNode;
  hideFooter?: boolean;
}) {
  return createPortal(
    <div
      className={['modal-backdrop', stacked ? 'is-stack' : ''].filter(Boolean).join(' ')}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal-card modal-${size} modal-${tone}${hideFooter ? ' modal-no-footer' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="desk-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="desk-modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="desk-modal-body">{children}</div>
        {hideFooter ? null : (
          <footer>
            {actions || (
              <Button type="button" onClick={onClose}>
                Close
              </Button>
            )}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
