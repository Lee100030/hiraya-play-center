import type { HirayaDatabase } from '@hiraya/types';
import { currentMonthKey, financeMonth, formatPeso, hklcTaskBoards, isAdmin, isTeacherApplication, operationsStats } from '@hiraya/utils';
import { FinanceCategoryChart, FinanceColumnChart, FinanceLegend, StatusBadge } from '@hiraya/ui';
import { type ReactNode, useState } from 'react';
import { Icons } from '../icons';
import { greeting, statusLabel, type ViewId } from '../lib/views';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatStamp(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const ROLE_ICONS: Record<string, keyof typeof Icons> = {
  'Program Director': 'programs',
  'Administrative Director': 'reports',
  Supervisor: 'progress',
  'Administrative Officer': 'enrollment',
  'Teacher — program tasks': 'teachers',
  'Teacher — admin tasks': 'attendance',
  Family: 'parents',
};

export function DashboardPage({
  store,
  name,
  role,
  onView,
}: {
  store: HirayaDatabase;
  name: string;
  role?: string;
  onView: (id: ViewId) => void;
}) {
  const today = todayKey();
  const stats = operationsStats(store);
  const pending = store.enrollmentApplications.filter(
    (row) =>
      !isTeacherApplication(row) && ['pending', 'pending_review'].includes((row.status || '').toLowerCase()),
  );
  const teacherPending = store.enrollmentApplications.filter(
    (row) => isTeacherApplication(row) && ['pending', 'pending_review'].includes((row.status || '').toLowerCase()),
  );
  const todaySessions = store.schedules.filter(
    (row) => row.kind !== 'teacherTask' && (row.startAt || '').slice(0, 10) === today && row.status !== 'cancelled',
  );
  const openTasks = (store.staffTasks || []).filter((row) => !['completed', 'cancelled'].includes(row.status));
  const overdueTasks = openTasks.filter(
    (row) => row.status === 'overdue' || (!!row.dueAt && row.dueAt.slice(0, 10) <= today && row.status !== 'completed'),
  );
  const publishedNews = store.news.filter((row) => row.isPublished || row.status === 'published');
  const draftNews = store.news.filter((row) => !row.isPublished && row.status !== 'published');
  const unreadAlerts = (store.alerts || []).filter((row) => !row.read && (row.kind || '').toLowerCase() !== 'direct');
  const activity = [...store.auditLogs].slice(0, 6);
  const [financeMonthKey, setFinanceMonthKey] = useState(currentMonthKey);
  const book = isAdmin(role) ? financeMonth(store, financeMonthKey) : null;

  return (
    <>
      <header className="welcome">
        <div>
          <p className="page-crumb">HIRAYA / Dashboard</p>
          <h1>{greeting(name)}</h1>
          <p className="muted">Live snapshot of the center. Open a card to jump to that desk.</p>
        </div>
      </header>

      <section className="stat-row dash-kpis" aria-label="Center snapshot">
        <Stat
          icon={<Icons.students />}
          label="Active students"
          value={stats.totalStudents}
          hint={`${store.students.length} on file`}
          onClick={() => onView('students')}
        />
        <Stat
          icon={<Icons.enrollment />}
          label="Pending applications"
          value={stats.pendingEnrollments}
          hint="Awaiting approval"
          onClick={() => onView('enrollment')}
        />
        <Stat
          icon={<Icons.calendar />}
          label="Sessions today"
          value={stats.todayClasses}
          hint="Class times on the calendar"
          onClick={() => onView('calendar')}
        />
        <Stat
          icon={<Icons.tasks />}
          label="Open tasks"
          value={stats.pendingTasks}
          hint={overdueTasks.length ? `${overdueTasks.length} due or overdue` : 'Assigned to teachers'}
          onClick={() => onView('tasks')}
        />
        <Stat
          icon={<Icons.sessions />}
          label="Session packages"
          value={(store.sessionPackages || []).length}
          hint={`${(store.sessionPackages || []).filter((row) => row.status === 'active').length} active`}
          onClick={() => onView('sessions')}
        />
        <Stat
          icon={<Icons.announcements />}
          label="Announcements"
          value={publishedNews.length}
          hint={draftNews.length ? `${draftNews.length} draft${draftNews.length === 1 ? '' : 's'} not published` : 'Published'}
          onClick={() => onView('announcements')}
        />
      </section>

      {book ? (
        <section className="finance-board" aria-label="Center income and expenses">
          <div className="finance-board-head">
            <div>
              <h2>Income and expenses</h2>
              <p>Counted student payments are income. Teacher pay plus center expenses are costs. Opening cash is carried money, not a new sale.</p>
            </div>
            <label>
              Month
              <input type="month" value={book.month} onChange={(event) => setFinanceMonthKey(event.target.value)} />
            </label>
          </div>
          <div className="finance-kpis">
            <article>
              <p>Income</p>
              <strong>₱{formatPeso(book.income)}</strong>
            </article>
            <article>
              <p>Expenses</p>
              <strong>₱{formatPeso(book.expenses)}</strong>
            </article>
            <article>
              <p>Net</p>
              <strong>₱{formatPeso(book.net)}</strong>
            </article>
            <article>
              <p>Opening cash</p>
              <strong>₱{formatPeso(book.opening)}</strong>
            </article>
          </div>
          <div className="finance-charts">
            <article className="panel">
              <h3>Last six months</h3>
              <FinanceColumnChart months={book.series} />
              <FinanceLegend />
            </article>
            <article className="panel">
              <h3>Expenses this month</h3>
              <FinanceCategoryChart rows={book.categories} />
            </article>
          </div>
          <button type="button" className="linkish" onClick={() => onView('finance')}>
            Open Center Cash flow
          </button>
        </section>
      ) : null}

      <div className="dash-section">
        <h2>Needs attention</h2>
        <p>Rows open the matching management page.</p>
      </div>
      <section className="split">
        <article className="panel dash-panel">
          <h2>Today’s sessions</h2>
          {todaySessions.length === 0 ? (
            <p className="panel-empty">No class sessions on the calendar for today.</p>
          ) : (
            <ul className="feed-list">
              {todaySessions.slice(0, 6).map((row) => (
                <li key={row.scheduleId}>
                  <button type="button" className="dash-link" onClick={() => onView('calendar')}>
                    <span>
                      <strong>{row.title || 'Class session'}</strong>
                      <small>{row.room || 'No room'} · {statusLabel(row.status)}</small>
                    </span>
                    <Icons.chevronRight />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="panel dash-panel">
          <h2>Pending applications</h2>
          {teacherPending.length > 0 ? (
            <p className="muted">
              <button type="button" className="linkish" onClick={() => onView('teacherApplications')}>
                {teacherPending.length} teacher application{teacherPending.length === 1 ? '' : 's'} waiting
              </button>
            </p>
          ) : null}
          {pending.length === 0 ? (
            <p className="panel-empty">No student applications waiting for approval.</p>
          ) : (
            <ul className="feed-list">
              {pending.slice(0, 6).map((row) => (
                <li key={row.applicationId}>
                  <button type="button" className="dash-link" onClick={() => onView('enrollment')}>
                    <span>
                      <strong>{row.studentFullname}</strong>
                      <small className="row-meta">
                        {row.preferredProgram || 'No program'}
                        <StatusBadge status={statusLabel(row.status)} />
                      </small>
                    </span>
                    <Icons.chevronRight />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
      <section className="split">
        <article className="panel dash-panel">
          <h2>Recent activity</h2>
          {activity.length === 0 ? (
            <p className="panel-empty">No recent center activity yet.</p>
          ) : (
            <ul className="feed-list">
              {activity.map((row) => (
                <li key={row.auditId}>
                  <div>
                    <strong>{row.summary || row.action}</strong>
                    <span>{row.actorName || row.module}</span>
                  </div>
                  <time dateTime={row.createdAt}>{formatStamp(row.createdAt)}</time>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="panel dash-panel">
          <h2>Unread alerts</h2>
          {unreadAlerts.length === 0 ? (
            <p className="panel-empty">No unread alerts.</p>
          ) : (
            <ul className="feed-list">
              {unreadAlerts.slice(0, 6).map((row) => (
                <li key={row.alertId}>
                  <button type="button" className="dash-link" onClick={() => onView('notifications')}>
                    <span>
                      <strong>{row.title || row.kind}</strong>
                      <small>{formatStamp(row.createdAt)}</small>
                    </span>
                    <Icons.chevronRight />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <div className="dash-section">
        <h2>Role reference</h2>
        <p>Workbook duties by role. These notes are not links.</p>
      </div>
      <section className="role-grid">
        {hklcTaskBoards(role).map((board) => {
          const iconKey = ROLE_ICONS[board.owner] || 'dashboard';
          const Icon = Icons[iconKey];
          return (
            <article className="panel role-card" key={board.owner}>
              <header className="role-card-head">
                <span className="stat-icon">
                  <Icon />
                </span>
                <div>
                  <h2>{board.owner}</h2>
                  <p>{board.items.length} duties</p>
                </div>
              </header>
              <ul className="role-list">
                {board.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </section>
    </>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="stat-card" onClick={onClick}>
      <span className="stat-icon">{icon}</span>
      <div className="stat-copy">
        <p>{label}</p>
        <strong>{value.toLocaleString('en-PH')}</strong>
        <small>{hint}</small>
      </div>
    </button>
  );
}
