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

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="hlc-field">
      <span className="hlc-label">{label}</span>
      {children}
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
  return <span className={`hlc-badge hlc-badge-${tone}`}>{status?.trim() ? status : 'Not assigned'}</span>;
}

export function emptyCell(value?: string | number | null) {
  if (value === 0) return '0';
  const text = String(value ?? '').trim();
  return text || 'Not assigned';
}

export function Avatar({
  name,
  photo,
  size = 40,
}: {
  name: string;
  photo?: string | null;
  size?: number;
}) {
  const label = (name || '?').trim() || '?';
  const initial = label.charAt(0).toUpperCase();
  return (
    <span className="hlc-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {photo ? <img src={photo} alt="" /> : <span aria-hidden="true">{initial}</span>}
    </span>
  );
}

export function PageHeader({
  kicker,
  crumb,
  title,
  description,
  actions,
}: {
  kicker?: string;
  crumb?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="hlc-page-header">
      <div>
        {crumb ? <Breadcrumb trail={['HIRAYA', crumb]} /> : null}
        {kicker ? <span className="hlc-workspace-chip">{kicker}</span> : null}
        <h1>{title}</h1>
        {description ? <p className="hlc-muted">{description}</p> : null}
      </div>
      {actions ? <div className="hlc-toolbar">{actions}</div> : null}
    </header>
  );
}

export function Modal({
  title,
  children,
  onClose,
  actions,
  busy,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  busy?: boolean;
}) {
  return (
    <div className="hlc-modal-back" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="hlc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hlc-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="hlc-modal-head">
          <h2 id="hlc-modal-title">{title}</h2>
          <button type="button" className="hlc-modal-x" onClick={onClose} disabled={busy} aria-label="Close">
            ×
          </button>
        </header>
        <div className="hlc-modal-body">{children}</div>
        {actions ? <footer className="hlc-modal-foot">{actions}</footer> : null}
      </div>
    </div>
  );
}

export function NetworkError({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  return (
    <div className="hlc-empty">
      <strong>Unable to connect to the local API.</strong>
      <p>{message || 'Check that Hiraya.Api is running on http://127.0.0.1:5188.'}</p>
      {onRetry ? (
        <button type="button" className="hlc-btn hlc-btn-primary" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
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

export function Breadcrumb({ trail }: { trail: string[] }) {
  return (
    <nav className="hlc-breadcrumb" aria-label="Breadcrumb">
      {trail.map((part, index) => (
        <span key={`${part}-${index}`}>
          {index > 0 ? <span aria-hidden="true"> / </span> : null}
          <span className={index === trail.length - 1 ? 'is-current' : undefined}>{part}</span>
        </span>
      ))}
    </nav>
  );
}

export function StatCard({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="hlc-stat-card" onClick={onClick} disabled={!onClick}>
      <p className="hlc-stat-label">{label}</p>
      <p className="hlc-stat-value">{value}</p>
      {hint ? <p className="hlc-stat-hint">{hint}</p> : null}
    </button>
  );
}

export function RolePlaybook({
  roles,
}: {
  roles: readonly { id: string; title: string; mark: string; items: readonly string[] }[];
}) {
  return (
    <div className="hlc-role-grid">
      {roles.map((role) => (
        <section key={role.id} className="hlc-card hlc-role-card">
          <div className="hlc-role-card-head">
            <span className="hlc-role-mark" aria-hidden="true">
              {role.mark}
            </span>
            <h3>{role.title}</h3>
          </div>
          <ul>
            {role.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
