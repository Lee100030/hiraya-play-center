import { Button } from '@hiraya/ui';
import type { ReactNode } from 'react';

export function DeskModal({
  title,
  children,
  onClose,
  tone = 'info',
  size = 'narrow',
  actions,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  tone?: 'info' | 'error' | 'success';
  size?: 'narrow' | 'wide';
  actions?: ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`modal-card modal-${size} modal-${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="desk-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="desk-modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="desk-modal-body">{children}</div>
        <footer>
          {actions || (
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
