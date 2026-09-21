'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { displayName, roleLabel } from '@hiraya/utils';
import { appNav, navGroupForPath } from '@/lib/nav';
import { useAuth } from './AuthProvider';
import { Avatar, Button } from '@hiraya/ui';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace('/admin');
  }, [ready, user, router]);

  if (!ready || !user) return <div className="hlc-loading">Opening HIRAYA…</div>;

  const items = appNav(user.role);
  const section = navGroupForPath(pathname, user.role);
  const account = items.filter((item) => item.href === '/app/profile' || item.href === '/app/settings');
  const main = items.filter((item) => item.href !== '/app/profile' && item.href !== '/app/settings');
  const groups = new Map<string, typeof main>();
  for (const item of main) {
    const key = item.group || 'Main';
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark" style={{ padding: '0.4rem 0.7rem 1rem', color: '#e8c547' }}>
          HIRAYA
          <span className="app-sublabel" style={{ display: 'block', marginTop: 4, paddingLeft: 0, borderLeft: 0, color: '#f7f1e1', opacity: 0.82 }}>
            Learning Center
          </span>
        </div>
        { [...groups.entries()].map(([group, links]) => (
          <div key={group} className="nav-group">
            <p>{group}</p>
            {links.map((item) => (
              <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}>
                {item.label}
              </Link>
            ))}
          </div>
        ))}
        <div style={{ marginTop: 'auto', padding: '1rem 0.5rem 0' }}>
          {account.map((item) => (
            <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}>
              {item.label}
            </Link>
          ))}
          <p style={{ margin: '0.6rem 0.7rem', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Avatar name={displayName(user)} photo={user.profileImagePath} size={32} />
            <span>
              {displayName(user)}
              <br />
              {roleLabel(user.role)}
            </span>
          </p>
          <Button
            variant="ghost"
            onClick={async () => {
              await logout();
              router.replace('/admin');
            }}
          >
            Sign out
          </Button>
        </div>
      </aside>
      <div>
        <header className="topbar">
          <div className="desk-topbar-brand">
            <strong>HIRAYA Learning Center</strong>
            <span className="desk-sublabel">{section}</span>
          </div>
          <span className="hlc-muted">Local hub</span>
        </header>
        <main className="page hlc-float-safe">{children}</main>
      </div>
    </div>
  );
}
