'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { displayName, roleLabel } from '@hiraya/utils';
import { appNav } from '@/lib/nav';
import { useAuth } from './AuthProvider';
import { StoreStatus } from './StoreStatus';
import { Button } from '@hiraya/ui';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace('/admin');
  }, [ready, user, router]);

  if (!ready || !user) return <div className="hlc-loading">Opening HIRAYA…</div>;

  const items = appNav(user.role);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark" style={{ padding: '0.4rem 0.7rem 1rem', color: '#e8c547' }}>
          HIRAYA
        </div>
        <p style={{ margin: '0 0.7rem 1rem', fontSize: 13, opacity: 0.85 }}>
          {displayName(user)}
          <br />
          {roleLabel(user.role)}
        </p>
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={pathname === item.href ? 'active' : ''}>
            {item.label}
          </Link>
        ))}
      </aside>
      <div>
        <header className="topbar">
          <strong>HIRAYA Learning Center</strong>
          <Button
            variant="ghost"
            onClick={async () => {
              await logout();
              router.replace('/admin');
            }}
          >
            Sign out
          </Button>
        </header>
        <main className="page">
          <StoreStatus />
          {children}
        </main>
      </div>
    </div>
  );
}
