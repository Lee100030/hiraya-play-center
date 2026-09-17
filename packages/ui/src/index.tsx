import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TableHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { statusLabel, statusTone } from '@hiraya/utils';

export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'icon' }) {
  return (
    <button className={['hlc-btn', `hlc-btn-${variant}`, className].filter(Boolean).join(' ')} {...props}>
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
  optional,
  hint,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
}) {
  const markOptional = optional && !/\(optional\)/i.test(label);
  return (
    <label className="hlc-field">
      <span className="hlc-label">
        {label}
        {required ? ' *' : markOptional ? ' (optional)' : ''}
      </span>
      {children}
      {hint ? <span className="hlc-field-hint">{hint}</span> : null}
      {error ? <span className="hlc-field-error">{error}</span> : null}
    </label>
  );
}

export function FieldLegend() {
  return (
    <p className="hlc-field-legend">
      Required fields are marked with *. Optional fields say (optional).
    </p>
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

export function EmptyValue({ label = 'Not assigned' }: { label?: string }) {
  return <span className="cell-empty">{label}</span>;
}

export function emptyCell(value?: string | number | null) {
  if (value == null) return <EmptyValue />;
  const text = String(value).trim();
  if (!text || text === '—') return <EmptyValue />;
  return text;
}

export function StatusBadge({ status }: { status?: string }) {
  const raw = (status || '').trim();
  if (!raw || raw === '—') {
    return <EmptyValue />;
  }
  const tone = statusTone(raw);
  return <span className={`hlc-badge hlc-badge-${tone}`}>{statusLabel(raw)}</span>;
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
    <table className="hlc-table" {...props}>
      {children}
    </table>
  );
}
