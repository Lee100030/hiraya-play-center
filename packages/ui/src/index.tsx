import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TableHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { statusTone } from '@hiraya/utils';

export function Button({
  variant = 'primary',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return (
    <button className={`hlc-btn hlc-btn-${variant}`} {...props}>
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="hlc-input" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="hlc-select" {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="hlc-textarea" {...props} />;
}

export function Field({
  label,
  children,
  error,
  required,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="hlc-field">
      <span className="hlc-label">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
      {error ? <span className="hlc-field-error">{error}</span> : null}
    </label>
  );
}

export function Card({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <section className="hlc-card">
      {title ? <h2 style={{ marginTop: 0 }}>{title}</h2> : null}
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status?: string }) {
  const tone = statusTone(status);
  return <span className={`hlc-badge hlc-badge-${tone}`}>{status || '—'}</span>;
}

export function Alert({
  kind = 'danger',
  children,
}: {
  kind?: 'danger' | 'success';
  children: ReactNode;
}) {
  return <div className={`hlc-alert hlc-alert-${kind}`}>{children}</div>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="hlc-loading">{label}</div>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="hlc-empty">
      <strong>{title}</strong>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}

export function Table({ children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="hlc-table" {...props}>
        {children}
      </table>
    </div>
  );
}
