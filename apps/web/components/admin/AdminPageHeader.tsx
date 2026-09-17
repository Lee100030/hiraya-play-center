import type { ReactNode } from 'react';

export function AdminPageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-page-head">
      <div className="admin-page-copy">
        <p className="admin-page-crumb">{`HIRAYA / ${title}`}</p>
        {kicker ? <p className="eyebrow">{kicker}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="admin-page-lead">{description}</p> : null}
      </div>
      {actions ? (
        <div className="hlc-crud-bar admin-page-actions" role="toolbar" aria-label="Page actions">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
