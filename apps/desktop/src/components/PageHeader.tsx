import type { ReactNode } from 'react';
import { Button } from '@hiraya/ui';

export function PageHeader({
  title,
  description,
  actions,
  kicker,
  crumb,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  kicker?: string;
  crumb?: string;
}) {
  return (
    <header className="page-head">
      <div className="page-head-copy">
        <p className="page-crumb">{crumb || `HIRAYA / ${title}`}</p>
        {kicker ? <p className="kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-head-actions">{actions}</div> : null}
    </header>
  );
}

export function Toolbar({
  query,
  onQuery,
  placeholder,
  extra,
  onReset,
  showReset,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  extra?: ReactNode;
  onReset?: () => void;
  showReset?: boolean;
}) {
  return (
    <div className="toolbar">
      <input
        className="hlc-input toolbar-search"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder.startsWith('Filter') ? placeholder : `Filter this list: ${placeholder}`}
      />
      {extra}
      {showReset && onReset ? (
        <Button type="button" variant="ghost" className="toolbar-reset" onClick={onReset}>
          Reset
        </Button>
      ) : null}
    </div>
  );
}
