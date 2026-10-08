'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { addLearningProgram, displayName, isAlertRead, isBuiltinManagementLane, managementLanesFor, markAllDirectsRead, markInboxRead, PAYMENT_LANES, parsePaymentLane, removeLearningProgram, roleLabel, unreadDirectAlerts, unreadInboxAlerts } from '@hiraya/utils';
import { Button, Field, Input } from '@hiraya/ui';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { StoreStatus } from '@/components/StoreStatus';
import { AdminModal } from '@/components/admin/AdminModal';

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
      { href: '/admin/program-tuition', label: 'Program tuition management', icon: '₱' },
      { href: '/admin/schedules', label: 'Schedule management', icon: '◷' },
      { href: '/admin/aba-schedule', label: 'ABA schedule', icon: '▦' },
      { href: '/admin/announcements', label: 'Announcement management', icon: '✉' },
      { href: '/admin/sessions', label: 'Session management', icon: '◌' },
    ],
  },
  {
    label: 'Enrollment',
    items: [
      { href: '/admin/enrollments', label: 'Enrollment Recording', icon: '✎' },
      { href: '/admin/teacher-applications', label: 'Teacher applications', icon: '★' },
    ],
  },
  {
    label: 'Records',
    items: [
      { href: '/admin/attendance', label: 'Teachers Attendance record', icon: '☑' },
      { href: '/admin/progress', label: 'Student progress', icon: '▲' },
      { href: '/admin/payments', label: 'Payments', icon: '₱' },
      { href: '/admin/expenses', label: 'Center Cash flow', icon: '₱' },
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
  const searchParams = useSearchParams();
  const peopleLane = searchParams.get('lane');
  const router = useRouter();
  const peopleHrefs = ['/admin/students', '/admin/parents', '/admin/staff', '/admin/modules', '/admin/sessions'];
  const paymentHref = '/admin/payments';
  const programLanes = useMemo(() => managementLanesFor(store), [store]);
  const paymentLane = parsePaymentLane(peopleLane);
  const section =
    navGroups.find((group) =>
      group.items.some((item) => (item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href))),
    )?.label || 'Dashboard';
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notes, setNotes] = useState(false);
  const [openPeopleNav, setOpenPeopleNav] = useState<string | null>(null);
  const [addingProgram, setAddingProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [programBusy, setProgramBusy] = useState(false);
  const [programError, setProgramError] = useState('');
  const unreadMessages = useMemo(
    () => unreadDirectAlerts(store.alerts, user?.userId || '').length,
    [store.alerts, user?.userId],
  );
  const unread = useMemo(
    () => unreadInboxAlerts(store.alerts, user?.userId || '').length,
    [store.alerts, user?.userId],
  );

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get('q') || '').trim();
    if (q) router.push(`/admin/students?q=${encodeURIComponent(q)}`);
  }

  const notesList = useMemo(
    () => unreadInboxAlerts(store.alerts, user?.userId || '').slice(0, 8),
    [store.alerts, user?.userId],
  );

  async function markAlertRead(alertId: string) {
    const current = store.alerts.find((item) => item.alertId === alertId);
    if (!current || isAlertRead(current)) return;
    const now = new Date().toISOString();
    await save({
      ...store,
      alerts: store.alerts.map((item) =>
        item.alertId === alertId ? { ...item, read: true, status: 'read', readAt: now } : item,
      ),
    });
  }

  async function clearInbox() {
    if (!user?.userId) return;
    await save({
      ...store,
      alerts: markAllDirectsRead(markInboxRead(store.alerts, user.userId), user.userId),
    });
    setNotes(false);
  }

  async function signOut() {
    await logout();
    router.replace('/admin');
  }

  async function saveNewProgram() {
    setProgramBusy(true);
    setProgramError('');
    try {
      const result = addLearningProgram(store, newProgramName);
      await save(result.store);
      setAddingProgram(false);
      setNewProgramName('');
      if (result.created && openPeopleNav) {
        router.push(`${openPeopleNav}?lane=${encodeURIComponent(result.program.programId)}`);
        setOpen(false);
      }
    } catch (err) {
      setProgramError(err instanceof Error ? err.message : 'Could not add that program.');
    } finally {
      setProgramBusy(false);
    }
  }

  async function deleteProgram(laneId: string, label: string) {
    if (isBuiltinManagementLane(laneId)) {
      window.alert('Built-in programs cannot be deleted.');
      return;
    }
    if (!window.confirm(`Remove “${label}” from every management list?`)) return;
    setProgramBusy(true);
    setProgramError('');
    try {
      const result = removeLearningProgram(store, laneId);
      await save(result.store);
      if (peopleLane === laneId && openPeopleNav) {
        router.push(openPeopleNav);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not remove that program.');
    } finally {
      setProgramBusy(false);
    }
  }

  useEffect(() => {
    const match = peopleHrefs.find((href) => pathname.startsWith(href));
    if (match) setOpenPeopleNav(match);
    else if (pathname.startsWith(paymentHref)) setOpenPeopleNav(paymentHref);
  }, [pathname, peopleLane]);

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
                const nestedPrograms = peopleHrefs.includes(item.href);
                const nestedPayments = item.href === paymentHref;
                const nested = nestedPrograms || nestedPayments;
                const current = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                const dropOpen = nested && openPeopleNav === item.href;
                return (
                  <div key={item.href} className={dropOpen ? 'nav-item-block is-expanded' : 'nav-item-block'}>
                    {nested ? (
                      <button
                        type="button"
                        className={
                          current
                            ? dropOpen
                              ? 'is-open has-caret'
                              : 'active has-caret'
                            : dropOpen
                              ? 'is-open has-caret'
                              : 'has-caret'
                        }
                        aria-expanded={dropOpen}
                        onClick={() => {
                          const nextOpen = openPeopleNav === item.href ? null : item.href;
                          setOpenPeopleNav(nextOpen);
                          if (nextOpen && !current) {
                            if (nestedPayments) {
                              router.push(`${item.href}?lane=teachers`);
                            } else {
                              router.push(item.href);
                            }
                          }
                        }}
                      >
                        <span className="nav-ico" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span className="nav-label">{item.label}</span>
                        <span className={dropOpen ? 'nav-caret is-open' : 'nav-caret'} aria-hidden="true">
                          ▸
                        </span>
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        className={current ? 'active' : ''}
                        onClick={() => setOpen(false)}
                      >
                        <span className="nav-ico" aria-hidden="true">
                          {item.icon}
                        </span>
                        {item.label}
                      </Link>
                    )}
                    {dropOpen && nestedPrograms ? (
                      <div className="nav-sub" role="group" aria-label={`${item.label} programs`}>
                        <Link
                          href={item.href}
                          className={current && !peopleLane ? 'active' : ''}
                          onClick={() => setOpen(false)}
                        >
                          All
                        </Link>
                        {programLanes.map((lane) => (
                          <div
                            key={lane.id}
                            className={
                              current && peopleLane === lane.id ? 'nav-sub-row is-active' : 'nav-sub-row'
                            }
                          >
                            <Link
                              href={`${item.href}?lane=${lane.id}`}
                              className="nav-sub-link"
                              onClick={() => setOpen(false)}
                            >
                              {lane.label}
                            </Link>
                            {!isBuiltinManagementLane(lane.id) ? (
                              <button
                                type="button"
                                className="nav-sub-delete"
                                title={`Remove ${lane.label}`}
                                aria-label={`Remove ${lane.label}`}
                                disabled={programBusy}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void deleteProgram(lane.id, lane.label);
                                }}
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                        ))}
                        <button
                          type="button"
                          className="nav-sub-add"
                          onClick={() => {
                            setProgramError('');
                            setNewProgramName('');
                            setAddingProgram(true);
                          }}
                        >
                          + Add program
                        </button>
                      </div>
                    ) : null}
                    {dropOpen && nestedPayments ? (
                      <div className="nav-sub" role="group" aria-label="Payment lists">
                        {PAYMENT_LANES.map((lane) => (
                          <Link
                            key={lane.id}
                            href={`${item.href}?lane=${lane.id}`}
                            className={current && paymentLane === lane.id ? 'active' : ''}
                            onClick={() => setOpen(false)}
                          >
                            {lane.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
        <div className="desk-top-brand">
          <strong>Hiraya Kids Learning Center</strong>
          <span className="desk-sublabel">{section}</span>
        </div>
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
              {notesList.length === 0 ? <p>No unread alerts.</p> : null}
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
              {unread > 0 || unreadMessages > 0 ? (
                <button type="button" onClick={() => void clearInbox()}>
                  Empty inbox
                </button>
              ) : null}
              <Link href="/admin/messages" onClick={() => setNotes(false)}>
                Open notifications
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
      {addingProgram ? (
        <AdminModal
          title="Add program"
          onClose={() => {
            if (programBusy) return;
            setAddingProgram(false);
            setProgramError('');
          }}
          footer={
            <>
              <Button type="button" variant="ghost" disabled={programBusy} onClick={() => setAddingProgram(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={programBusy} onClick={() => void saveNewProgram()}>
                {programBusy ? 'Saving…' : 'Add program'}
              </Button>
            </>
          }
        >
          {programError ? <p className="hlc-field-error">{programError}</p> : null}
          <Field
            label="Program name"
            required
            hint="Appears under Student, Parent, Teacher, Module, and Session management for everyone."
          >
            <Input
              value={newProgramName}
              onChange={(event) => setNewProgramName(event.target.value)}
              placeholder="e.g. Summer enrichment"
              autoFocus
            />
          </Field>
        </AdminModal>
      ) : null}
      </div>
    </div>
  );
}
