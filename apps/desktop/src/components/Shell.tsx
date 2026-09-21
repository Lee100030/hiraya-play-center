import { useMemo, type ReactNode } from 'react';
import { Avatar, Button } from '@hiraya/ui';
import { displayName, roleLabel } from '@hiraya/utils';
import type { HirayaUser } from '@hiraya/types';
import { deskNav, type ViewId } from '../lib/views';

export function Shell({
  user,
  view,
  error,
  onView,
  onLogout,
  onRetry,
  children,
}: {
  user: HirayaUser;
  view: ViewId;
  error: string | null;
  onView: (id: ViewId) => void;
  onLogout: () => void;
  onRetry?: () => void;
  children: ReactNode;
}) {
  const items = deskNav(user.role);
  const groups = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <div className="desk-shell">
      <aside className="desk-nav">
        <div className="desk-brand">
          <strong>HIRAYA</strong>
          <span>Learning Center</span>
        </div>
        <nav>
          {groups.map(([group, links]) => (
            <div key={group} className="nav-group">
              <p>{group}</p>
              {links.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={view === item.id || (view === 'teacher-workspace' && item.id === 'staff') ? 'active' : ''}
                  onClick={() => onView(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="desk-nav-foot">
          <button type="button" className={view === 'profile' ? 'active' : ''} onClick={() => onView('profile')}>
            <Avatar name={displayName(user)} photo={user.profileImagePath || undefined} size={32} />
            <span>
              <strong>{displayName(user)}</strong>
              <small>{roleLabel(user.role)}</small>
            </span>
          </button>
          <button type="button" onClick={() => onView('settings')}>
            Settings
          </button>
          <Button variant="ghost" type="button" onClick={onLogout}>
            Sign out
          </Button>
        </div>
      </aside>
      <div className="desk-main-wrap">
        <header className="desk-topbar">
          <strong>HIRAYA operations</strong>
          {error ? (
            <span className="desk-top-error">
              {error} {onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}
            </span>
          ) : (
            <span>Local API · live store</span>
          )}
        </header>
        <main className="desk-main hlc-float-safe">{children}</main>
      </div>
    </div>
  );
}
