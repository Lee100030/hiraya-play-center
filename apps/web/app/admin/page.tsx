'use client';

import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { FinanceLinesDelete, Loading, StatusBadge } from '@hiraya/ui';
import { FinanceCategoryChart, FinanceColumnChart, FinanceLegend } from '@hiraya/ui';
import { cashFlowLines, centerTuitionTotals, currentMonthKey, financeMonth, formatDate, formatPeso, isAdmin, isTeacherApplication, operationsStats, removeCashFlowLine, scrubLeftoverCenterRecords } from '@hiraya/utils';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

function monthKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { store, loading, error, save } = useStore();
  const scrubbedLeftovers = useRef(false);
  useEffect(() => {
    if (loading || scrubbedLeftovers.current) return;
    const next = scrubLeftoverCenterRecords(store);
    if (!next) return;
    scrubbedLeftovers.current = true;
    void save(next).catch(() => {
      scrubbedLeftovers.current = false;
    });
  }, [loading, store, save]);
  const [sort, setSort] = useState<'date' | 'name'>('date');
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [financeMonthKey, setFinanceMonthKey] = useState(currentMonthKey);
  const [financeBusy, setFinanceBusy] = useState(false);
  const book = isAdmin(user?.role) ? financeMonth(store, financeMonthKey) : null;
  const financeLines = book ? cashFlowLines(store, book.month) : [];

  const stats = operationsStats(store);
  const learnerApplications = store.enrollmentApplications.filter((row) => !isTeacherApplication(row));
  const pending = learnerApplications.filter((row) => row.status === 'pending_review' || row.status === 'pending');
  const thisMonth = new Date().toISOString().slice(0, 7);
  const newEnrollments = learnerApplications.filter((row) => (row.submittedAt || '').startsWith(thisMonth));
  const collected = centerTuitionTotals(store);

  const months = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return keys.map((key) => ({
      key,
      count: learnerApplications.filter((row) => monthKey(row.submittedAt || '') === key).length,
    }));
  }, [learnerApplications]);

  const programBars = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of learnerApplications) {
      const name = row.preferredProgram || 'Unspecified';
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    if (counts.size === 0) {
      for (const program of store.programs) counts.set(program.name, 0);
    }
    const max = Math.max(1, ...counts.values());
    return [...counts.entries()].slice(0, 6).map(([name, count]) => ({ name, count, pct: (count / max) * 100 }));
  }, [learnerApplications, store.programs]);

  const maxMonth = Math.max(1, ...months.map((item) => item.count));
  const chartPad = 8;
  const points = months
    .map((item, index) => {
      const x = chartPad + (index / Math.max(1, months.length - 1)) * (100 - chartPad * 2);
      const y = 78 - (item.count / maxMonth) * 58;
      return `${x},${y}`;
    })
    .join(' ');

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    const list = learnerApplications
      .filter((row) => `${row.studentFullname} ${row.preferredProgram} ${row.parentFullname}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) =>
        sort === 'name'
          ? a.studentFullname.localeCompare(b.studentFullname)
          : String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')),
      );
    return list;
  }, [learnerApplications, query, sort]);

  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice(page * pageSize, page * pageSize + pageSize);

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Overview"
        title="Dashboard"
        description={user?.fullname ? `Welcome back, ${user.fullname}.` : 'Welcome back.'}
      />
      {error ? <p className="field-error">{error}</p> : null}

      <div className="kpi-grid">
        <Link className="kpi-card" href="/admin/students">
          <div className="kpi-icon" aria-hidden="true">
            ☺
          </div>
          <p className="kpi-label">Total Students</p>
          <strong className="kpi-value">{stats.totalStudents}</strong>
        </Link>
        <Link className="kpi-card" href="/admin/enrollments">
          <div className="kpi-icon" aria-hidden="true">
            ✎
          </div>
          <p className="kpi-label">New Enrollments</p>
          <strong className="kpi-value">{newEnrollments.length || learnerApplications.length}</strong>
        </Link>
        <Link className="kpi-card" href="/admin/enrollments">
          <div className="kpi-icon" aria-hidden="true">
            ◷
          </div>
          <p className="kpi-label">Pending Applications</p>
          <strong className="kpi-value">{stats.pendingEnrollments}</strong>
          {stats.pendingTeacherApplications > 0 ? (
            <p className="kpi-label">
              {stats.pendingTeacherApplications} teacher application{stats.pendingTeacherApplications === 1 ? '' : 's'} in Enrollment
            </p>
          ) : null}
        </Link>
        <Link className="kpi-card" href="/admin/payments">
          <div className="kpi-icon" aria-hidden="true">
            ₱
          </div>
          <p className="kpi-label">Total paid</p>
          <strong className="kpi-value">₱{collected.paid.toLocaleString()}</strong>
          <p className="kpi-label">Outstanding balance ₱{collected.outstanding.toLocaleString()}</p>
        </Link>
      </div>

      <div className="quick-actions">
        <Link className="dash-action dash-action-primary" href="/admin/students">
          Add Student
        </Link>
        <Link className="dash-action" href="/admin/programs">
          Add Program
        </Link>
        <Link className="dash-action" href="/admin/announcements">
          Send Announcement
        </Link>
      </div>

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
          <FinanceLinesDelete
            lines={financeLines}
            busy={financeBusy}
            onDelete={async (ids) => {
              setFinanceBusy(true);
              try {
                let next = store;
                for (const id of ids) {
                  try {
                    next = removeCashFlowLine(next, id);
                  } catch {
                    /* already gone */
                  }
                }
                await save(next);
              } finally {
                setFinanceBusy(false);
              }
            }}
          />
          <div className="finance-charts">
            <section className="hlc-card chart-panel">
              <h2>Last six months</h2>
              <FinanceColumnChart months={book.series} />
              <FinanceLegend />
            </section>
            <section className="hlc-card chart-panel">
              <h2>Expenses this month</h2>
              <FinanceCategoryChart rows={book.categories} />
            </section>
          </div>
          <Link className="dash-action" href="/admin/expenses">
            Open Center Cash flow
          </Link>
        </section>
      ) : null}

      <div className="chart-grid">
        <section className="hlc-card chart-panel">
          <h2>Enrollment trends</h2>
          <div className="chart-body">
            <svg
              className="trend-chart"
              viewBox="0 0 100 92"
              preserveAspectRatio="none"
              role="img"
              aria-label="Enrollment applications over six months"
            >
              <polyline fill="none" stroke="#c9a227" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={points} />
              {months.map((item, index) => {
                const x = 8 + (index / Math.max(1, months.length - 1)) * 84;
                const y = 78 - (item.count / maxMonth) * 58;
                return <circle key={item.key} cx={x} cy={y} r="1.8" fill="#14301f" />;
              })}
            </svg>
          </div>
          <div className="chart-legend">
            {months.map((item) => (
              <span key={item.key}>
                {item.key.slice(5)} · {item.count}
              </span>
            ))}
          </div>
        </section>
        <section className="hlc-card chart-panel">
          <h2>Program distribution</h2>
          <ul className="bar-chart">
            {programBars.length === 0 ? (
              <li>No program data yet.</li>
            ) : (
              programBars.map((item) => (
                <li key={item.name}>
                  <span className="bar-name">{item.name}</span>
                  <div className="bar-track" aria-hidden="true">
                    <i style={{ width: `${Math.max(item.pct, 4)}%` }} />
                  </div>
                  <em className="bar-count">{item.count}</em>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="hlc-card activity-card">
        <div className="toolbar">
          <h2>Recent activity</h2>
          <input
            className="hlc-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Filter enrollments and messages"
          />
        </div>
        {pageRows.length === 0 ? (
          <p>No enrollment applications yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="hlc-table striped">
              <thead>
                <tr>
                  <th>
                    <button type="button" onClick={() => setSort('name')}>
                      Student
                    </button>
                  </th>
                  <th>Program</th>
                  <th>
                    <button type="button" onClick={() => setSort('date')}>
                      Submitted
                    </button>
                  </th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.applicationId}>
                    <td>{row.studentFullname}</td>
                    <td>{row.preferredProgram}</td>
                    <td>{formatDate(row.submittedAt) || <StatusBadge status="" />}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      <Link href="/admin/enrollments" aria-label={`View ${row.studentFullname}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pager">
          <button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>
            Next
          </button>
        </div>
      </section>
    </>
  );
}
