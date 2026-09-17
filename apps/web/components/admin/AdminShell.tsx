'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { displayName, roleLabel } from '@hiraya/utils';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { StoreStatus } from '@/components/StoreStatus';

const navGroups = [
  {
    label: 'Main',
    items: [{ href: '/admin', label: 'Operations Dashboard', icon: '▣' }],
  },
  {
    label: 'Management',
    items: [
      { href: '/admin/students', label: 'Student management', icon: '☺' },
      { href: '/admin/parents', label: 'Parent management', icon: '♡' },
      { href: '/admin/staff', label: 'Teachers Management', icon: '★' },
      { href: '/admin/modules', label: 'Module management', icon: '▤' },
      { href: '/admin/schedules', label: 'Schedule management', icon: '◷' },
      { href: '/admin/tasks', label: 'Task management', icon: '✓' },
      { href: '/admin/announcements', label: 'Announcement management', icon: '✉' },
      { href: '/admin/sessions', label: 'Session management', icon: '◌' },
    ],
  },
  {
    label: 'Enrollment',
    items: [{ href: '/admin/enrollments', label: 'Enrollment Recording', icon: '✎' }],
  },
  {
    label: 'Records',
    items: [
      { href: '/admin/programs', label: 'Programs', icon: '▤' },
      { href: '/admin/classes', label: 'Classes', icon: '⌂' },
      { href: '/admin/attendance', label: 'Attendance', icon: '☑' },
      { href: '/admin/progress', label: 'Progress', icon: '▲' },
      { href: '/admin/payments', label: 'Payments', icon: '₱' },
      { href: '/admin/messages', label: 'Notifications', icon: '🔔' },
      { href: '/admin/reports', label: 'Reports', icon: '▦' },
      { href: '/admin/website', label: 'Marketing site', icon: '◈' },
      { href: '/admin/settings', label: 'Settings', icon: '⚙' },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { store, save } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notes, setNotes] = useState(false);
  const unreadMessages = useMemo(
    () =>
      store.alerts.filter(
        (item) =>
          (item.kind || '').toLowerCase() === 'direct' &&
          item.recipientId === user?.userId &&
          !item.read &&
          item.status !== 'sent',
      ).length,
    [store.alerts, user?.userId],
  );
  const unread = useMemo(
    () =>
      store.alerts.filter(
        (item) =>
          (item.kind || '').toLowerCase() !== 'direct' &&
          item.status !== 'read' &&
          (!item.recipientId || item.recipientId === user?.userId || item.recipientId === 'everyone'),
      ).length +
      store.enrollmentApplications.filter((row) => row.status === 'pending_review' || row.status === 'pending').length,
    [store.alerts, store.enrollmentApplications, user?.userId],
  );

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get('q') || '').trim();
    if (q) router.push(`/admin/students?q=${encodeURIComponent(q)}`);
  }

  const notesList = useMemo(
    () =>
      store.alerts
        .filter(
          (item) =>
            (item.kind || '').toLowerCase() !== 'direct' &&
            (!item.recipientId || item.recipientId === user?.userId || item.recipientId === 'everyone'),
        )
        .slice(0, 8),
    [store.alerts, user?.userId],
  );

  async function markAlertRead(alertId: string) {
    const now = new Date().toISOString();
    const current = store.alerts.find((item) => item.alertId === alertId);
    if (!current || current.read) return;
    await save({
      ...store,
      alerts: store.alerts.map((item) =>
        item.alertId === alertId ? { ...item, read: true, status: 'read', readAt: now } : item,
      ),
    });
  }

  async function signOut() {
    await logout();
    router.replace('/admin');
  }

  return (
    <div className={open ? 'admin-shell nav-open' : 'admin-shell'}>
      <div className="admin-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className={open ? 'admin-sidebar open' : 'admin-sidebar'} id="admin-drawer">
        <div className="admin-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hiraya-crest.png" alt="" width={36} height={36} />
          <div>
            <strong>HIRAYA</strong>
        <span>Operations</span>
          </div>
        </div>
        <nav aria-label="Admin">
          {navGroups.map((group) => (
            <div key={group.label} className="admin-nav-group">
              <p className="admin-nav-heading">{group.label}</p>
              {group.items.map((item) => {
                const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={active ? 'active' : ''}
                    onClick={() => setOpen(false)}
                  >
                    <span className="nav-ico" aria-hidden="true">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <div className="admin-stage">
        <header className="admin-topbar">
        <button
          type="button"
          className="admin-menu-btn"
          aria-expanded={open}
          aria-controls="admin-drawer"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true">{open ? '✕' : '☰'}</span>
        </button>
        <form className="admin-search" onSubmit={onSearch} role="search">
          <label className="sr-only" htmlFor="admin-search">
            Jump to a student or application
          </label>
          <input
            id="admin-search"
            name="q"
            placeholder="Jump to a student or application"
            title="Global jump. Use Filter this list on each page to narrow the table."
          />
        </form>
        <div className="admin-top-actions">
          <Link
            href="/admin/messages"
            className="admin-bell"
            aria-label={unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'Messages'}
            title="Messages"
          >
            <span aria-hidden="true">💬</span>
            {unreadMessages > 0 ? <em>{unreadMessages > 9 ? '9+' : unreadMessages}</em> : null}
          </Link>
          <button
            type="button"
            className="admin-bell"
            aria-label={`Notifications, ${unread} unread`}
            onClick={() => {
              setNotes((value) => !value);
              setMenu(false);
            }}
          >
            <span aria-hidden="true">🔔</span>
            {unread > 0 ? <em>{unread > 9 ? '9+' : unread}</em> : null}
          </button>
          {notes ? (
            <div className="admin-pop">
              <strong>Inbox</strong>
              {notesList.length === 0 ? <p>No alerts.</p> : null}
              {notesList.map((item) => (
                <button
                  key={item.alertId}
                  type="button"
                  onClick={() => {
                    void markAlertRead(item.alertId);
                    setNotes(false);
                  }}
                >
                  {item.title || item.kind}
                </button>
              ))}
              <Link href="/admin/enrollments" onClick={() => setNotes(false)}>
                Review enrollments
              </Link>
            </div>
          ) : null}
          <button
            type="button"
            className="admin-avatar"
            onClick={() => {
              setMenu((value) => !value);
              setNotes(false);
            }}
            aria-expanded={menu}
          >
            <span>{(displayName(user) || 'A').slice(0, 1).toUpperCase()}</span>
            <small>
              {displayName(user)}
              <br />
              {roleLabel(user?.role)}
            </small>
          </button>
          {menu ? (
            <div className="admin-pop admin-pop-profile">
              <Link href="/admin/profile" onClick={() => setMenu(false)}>
                Profile
              </Link>
              <Link href="/admin/settings" onClick={() => setMenu(false)}>
                Settings
              </Link>
              <button type="button" onClick={signOut}>
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="admin-content">
        <StoreStatus />
        {children}
      </main>
      </div>
    </div>
  );
}
