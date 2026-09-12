'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { displayName, roleLabel } from '@hiraya/utils';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@hiraya/ui';

const items = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/enrollments', label: 'Enrollments' },
  { href: '/admin/students', label: 'Students' },
  { href: '/admin/programs', label: 'Programs' },
  { href: '/admin/schedules', label: 'Schedules' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/settings', label: 'Settings' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="admin-shell">
      <button type="button" className="admin-menu-btn" onClick={() => setOpen((value) => !value)}>
        {open ? 'Close menu' : 'Menu'}
      </button>
      <aside className={open ? 'admin-sidebar open' : 'admin-sidebar'}>
        <div className="admin-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hiraya-crest.png" alt="" width={36} height={36} />
          <div>
            <strong>HIRAYA</strong>
            <span>Admin</span>
          </div>
        </div>
        <p className="admin-user">
          {displayName(user)}
          <br />
          {roleLabel(user?.role)}
        </p>
        <nav>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? 'active' : ''}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Button
          variant="ghost"
          onClick={async () => {
            await logout();
            router.replace('/admin');
          }}
        >
          Logout
        </Button>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <strong>HIRAYA Learning Center</strong>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
