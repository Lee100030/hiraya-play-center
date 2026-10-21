import { Button } from '@hiraya/ui';
import { type FormEvent, type ReactNode, useRef } from 'react';
import { createPortal } from 'react-dom';

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="form-section form-span">
      <h3 className="form-section-title">{title}</h3>
      <div className="form-section-body">{children}</div>
    </section>
  );
}

export function EditorModal({
  title,
  children,
  error,
  busy,
  submitLabel,
  submitDisabled = false,
  onClose,
  onSubmit,
  legend = true,
}: {
  title: string;
  children: ReactNode;
  error?: string | null;
  busy?: boolean;
  submitLabel: string;
  submitDisabled?: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  legend?: boolean;
}) {
  const saving = useRef(false);
  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="modal-card"
        encType="multipart/form-data"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey) return;
          const target = event.target;
          if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
          if (target.type === 'submit' || target.type === 'button' || target.type === 'hidden') return;
          event.preventDefault();
          const fields = [...event.currentTarget.querySelectorAll<HTMLElement>('input, select, textarea')].filter(
            (field) =>
              field.tabIndex !== -1 &&
              !field.hasAttribute('hidden') &&
              !(field instanceof HTMLInputElement && (field.type === 'hidden' || field.disabled)),
          );
          const next = fields[fields.indexOf(target) + 1];
          next?.focus();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (saving.current || busy || submitDisabled) return;
          saving.current = true;
          Promise.resolve(onSubmit(event)).finally(() => {
            saving.current = false;
          });
        }}
      >
        <header>
          <div className="modal-heading">
            <h2>{title}</h2>
            {legend ? <p className="form-legend">* Required</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="form-grid">{children}</div>
        <footer>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || submitDisabled}>
            {busy ? 'Saving…' : submitLabel}
          </Button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
