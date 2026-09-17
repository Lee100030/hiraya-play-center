import { Button } from '@hiraya/ui';
import { displayName, formatDate, roleLabel } from '@hiraya/utils';
import type { HirayaDatabase, HirayaUser, SystemAlert } from '@hiraya/types';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icons } from '../icons';
import { desktopNav, type ViewId } from '../lib/views';
import { DeskModal } from './DeskModal';
import { MessengerInbox } from '../pages/MessagesPage';
import { AssistantDock } from './AssistantDock';

export function Shell({
  user,
  store,
  view,
  collapsed,
  loading,
  loadError,
  onView,
  onCollapse,
  onLogout,
  onRefresh,
  onMarkRead,
  onStore,
  saveStore,
  children,
}: {
  user: HirayaUser;
  store: HirayaDatabase;
  view: ViewId;
  collapsed: boolean;
  loading: boolean;
  loadError: string | null;
  onView: (id: ViewId) => void;
  onCollapse: () => void;
  onLogout: () => void;
  onRefresh: () => void;
  onMarkRead: (id: string) => void;
  onStore: (next: HirayaDatabase) => void;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  children: ReactNode;
}) {
  const [inboxOpen, setInboxOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [activeAlert, setActiveAlert] = useState<SystemAlert | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [query, setQuery] = useState('');
  const alerts = useMemo(
    () =>
      [...(store.alerts || [])]
        .filter((alert) => (alert.kind || '').toLowerCase() !== 'direct')
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [store.alerts],
  );
  const unreadAlerts = alerts.filter((alert) => !alert.read);
  const unread = unreadAlerts.length;
  const unreadMessages = (store.alerts || []).filter(
    (alert) =>
      (alert.kind || '').toLowerCase() === 'direct' &&
      alert.recipientId === user.userId &&
      !alert.read &&
      alert.status !== 'sent',
  ).length;
  const groups = desktopNav(user.role);
  const iconMap = Icons as Record<string, (props?: { width?: number; height?: number }) => ReactNode>;

  useEffect(() => {
    setErrorOpen(Boolean(loadError));
  }, [loadError]);

  useEffect(() => {
    const latest = unreadAlerts[0];
    if (!latest) return;
    const key = `hiraya.popupAlert.${latest.alertId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      return;
    }
    setActiveAlert(latest);
  }, [unreadAlerts[0]?.alertId]);

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const people = store.students
      .filter((row) => `${row.fullname} ${row.program}`.toLowerCase().includes(q))
      .slice(0, 5)
      .map((row) => ({ id: row.studentId, label: row.fullname || 'Student', view: 'students' as ViewId }));
    const apps = store.enrollmentApplications
      .filter((row) => `${row.studentFullname} ${row.parentFullname}`.toLowerCase().includes(q))
      .slice(0, 4)
      .map((row) => ({ id: row.applicationId, label: row.studentFullname, view: 'enrollment' as ViewId }));
    return [...people, ...apps];
  }, [query, store.students, store.enrollmentApplications]);

  function openAlert(alert: SystemAlert) {
    setActiveAlert(alert);
    if (!alert.read) onMarkRead(alert.alertId);
  }

  return (
    <div className={collapsed ? 'desk-shell collapsed' : 'desk-shell'}>
      <aside className="desk-nav">
        <div className="nav-brand">
          <img src="./images/hiraya-crest.png" alt="" width={36} height={36} />
          {!collapsed ? (
            <div>
              <strong>HIRAYA</strong>
              <span>Learning Center</span>
            </div>
          ) : null}
        </div>
        <nav>
          {groups.map((group) => (
            <div key={group.label} className="nav-group">
              {!collapsed ? <p>{group.label}</p> : <p className="nav-group-dot">•</p>}
              {group.items.map((item) => {
                const Icon = iconMap[item.id] || Icons.dashboard;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={view === item.id ? 'active' : ''}
                    title={collapsed ? item.label : undefined}
                    onClick={() => onView(item.id)}
                  >
                    <i className="nav-ico" aria-hidden="true">
                      <Icon width={18} height={18} />
                    </i>
                    {!collapsed ? <span>{item.label}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="nav-foot">
          {!collapsed ? (
            <div className="nav-user">
              <strong>{displayName(user)}</strong>
              <span>{roleLabel(user.role)}</span>
            </div>
          ) : null}
          <button type="button" className="nav-logout" onClick={onLogout} title="Sign out">
            <Icons.logout />
            {!collapsed ? <span>Sign out</span> : null}
          </button>
        </div>
      </aside>
      <div className="desk-body">
        <header className="desk-top">
          <button type="button" className="icon-btn" onClick={onCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <Icons.menu /> : <Icons.chevron />}
          </button>
          <div className="top-search">
            <Icons.search width={16} height={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Jump to a student or application"
              aria-label="Jump to a student or application"
              title="Global jump. Use Filter this list on each page to narrow the table."
            />
            {searchHits.length > 0 ? (
              <div className="search-menu" role="listbox">
                {searchHits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => {
                      onView(hit.view);
                      setQuery('');
                    }}
                  >
                    {hit.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="top-actions">
            <button type="button" className="icon-btn" onClick={() => onView('calendar')} aria-label="Open calendar" title="Calendar">
              <Icons.calendar />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'Messages'}
              title="Messages"
              onClick={() => {
                setMessagesOpen(true);
                setInboxOpen(false);
                setProfileOpen(false);
              }}
            >
              <Icons.chat />
              {unreadMessages > 0 ? <em>{unreadMessages > 9 ? '9+' : unreadMessages}</em> : null}
            </button>
            <div className="menu-wrap">
              <button
                type="button"
                className="icon-btn"
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                onClick={() => {
                  setInboxOpen(true);
                  setProfileOpen(false);
                }}
              >
                <Icons.notifications />
                {unread > 0 ? <em>{unread > 9 ? '9+' : unread}</em> : null}
              </button>
            </div>
            <div className="menu-wrap">
              <button
                type="button"
                className="profile-chip"
                onClick={() => {
                  setProfileOpen((open) => !open);
                }}
              >
                <span>{displayName(user).slice(0, 1) || 'A'}</span>
                <div>
                  <strong>{displayName(user)}</strong>
                  <small>{roleLabel(user.role)}</small>
                </div>
              </button>
              {profileOpen ? (
                <div className="dropdown">
                  <p>{user.email || 'Center account'}</p>
                  <button type="button" onClick={() => { onView('settings'); setProfileOpen(false); }}>
                    Settings
                  </button>
                  <button type="button" onClick={onLogout}>
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="desk-main">{loading ? <DeskSkeleton /> : children}</main>
      </div>

      {messagesOpen ? (
        <DeskModal
          title="Messages"
          size="wide"
          onClose={() => setMessagesOpen(false)}
          actions={
            <Button type="button" onClick={() => setMessagesOpen(false)}>
              Close
            </Button>
          }
        >
          <MessengerInbox store={store} user={user} onStore={onStore} saveStore={saveStore} />
        </DeskModal>
      ) : null}

      {inboxOpen ? (
        <DeskModal
          title={unread ? `Notifications (${unread} unread)` : 'Notifications'}
          onClose={() => setInboxOpen(false)}
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onView('notifications');
                  setInboxOpen(false);
                }}
              >
                Open inbox
              </Button>
              <Button type="button" onClick={() => setInboxOpen(false)}>
                Close
              </Button>
            </>
          }
        >
          {alerts.length === 0 ? (
            <p>No notifications yet.</p>
          ) : (
            <div className="notice-list">
              {alerts.map((alert) => (
                <button
                  key={alert.alertId}
                  type="button"
                  className={alert.read ? '' : 'unread'}
                  onClick={() => {
                    setInboxOpen(false);
                    openAlert(alert);
                  }}
                >
                  <strong>{alert.title || alert.kind}</strong>
                  <span>{alert.message || 'Open to read this notice.'}</span>
                  <small>{formatDate(alert.createdAt)}</small>
                </button>
              ))}
            </div>
          )}
        </DeskModal>
      ) : null}

      {activeAlert && !(loadError && errorOpen) ? (
        <DeskModal
          title={activeAlert.title || activeAlert.kind || 'Notification'}
          onClose={() => setActiveAlert(null)}
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setActiveAlert(null);
                  setInboxOpen(true);
                }}
              >
                All notifications
              </Button>
              <Button type="button" onClick={() => setActiveAlert(null)}>
                Close
              </Button>
            </>
          }
        >
          <p>{activeAlert.message || 'No additional details were saved with this notice.'}</p>
          <p className="desk-modal-meta">{formatDate(activeAlert.createdAt)}</p>
        </DeskModal>
      ) : null}

      {loadError && errorOpen ? (
        <DeskModal
          title="Couldn’t refresh center records"
          tone="error"
          onClose={() => setErrorOpen(false)}
          actions={
            <>
              <Button type="button" variant="ghost" onClick={() => setErrorOpen(false)}>
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setErrorOpen(false);
                  onRefresh();
                }}
              >
                Try again
              </Button>
            </>
          }
        >
          <p>{loadError}</p>
        </DeskModal>
      ) : null}

      <AssistantDock
        store={store}
        onView={onView}
        onOpenMessages={() => {
          setMessagesOpen(true);
          setInboxOpen(false);
          setProfileOpen(false);
        }}
      />
    </div>
  );
}

function DeskSkeleton() {
  return (
    <div className="skeleton-grid" aria-hidden="true">
      <div className="skel" />
      <div className="skel" />
      <div className="skel" />
      <div className="skel wide" />
    </div>
  );
}
