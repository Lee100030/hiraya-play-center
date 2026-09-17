'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useStore } from '@/components/StoreProvider';
import { Loading } from '@hiraya/ui';
import { enrollmentStatusLabel } from '@/lib/enrollment';
import { useMemo } from 'react';

function monthKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminReportsPage() {
  const { store, loading } = useStore();

  const revenue = store.payments.reduce((sum, row) => sum + (Number(row.amountPaid) || 0), 0);
  const present = store.attendance.filter((item) => item.status === 'present' || item.status === 'late').length;
  const attendanceRate = store.attendance.length ? Math.round((present / store.attendance.length) * 100) : 0;

  const months = useMemo(() => {
    const keys: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return keys.map((key) => ({
      key,
      count: store.enrollmentApplications.filter((row) => monthKey(row.submittedAt || '') === key).length,
      paid: store.payments.filter((row) => (row.paidAt || row.paymentDate || '').startsWith(key)).reduce((sum, row) => sum + Number(row.amountPaid || 0), 0),
    }));
  }, [store.enrollmentApplications, store.payments]);

  const statusSlices = useMemo(() => {
    const counts = { Pending: 0, Approved: 0, Rejected: 0 };
    for (const row of store.enrollmentApplications) {
      const label = enrollmentStatusLabel(row.status);
      if (label === 'Pending') counts.Pending += 1;
      else if (label === 'Approved') counts.Approved += 1;
      else if (label === 'Rejected') counts.Rejected += 1;
    }
    const total = Math.max(1, counts.Pending + counts.Approved + counts.Rejected);
    return [
      { name: 'Pending', value: counts.Pending, color: '#b8860b', pct: (counts.Pending / total) * 100 },
      { name: 'Approved', value: counts.Approved, color: '#1f7a4d', pct: (counts.Approved / total) * 100 },
      { name: 'Rejected', value: counts.Rejected, color: '#c44536', pct: (counts.Rejected / total) * 100 },
    ];
  }, [store.enrollmentApplications]);

  const maxMonth = Math.max(1, ...months.map((item) => item.count));
  const maxPay = Math.max(1, ...months.map((item) => item.paid));
  const points = months
    .map((item, index) => {
      const x = 8 + (index / Math.max(1, months.length - 1)) * 84;
      const y = 78 - (item.count / maxMonth) * 58;
      return `${x},${y}`;
    })
    .join(' ');

  function exportCsv() {
    const lines = [
      'Report,Value',
      `Total Revenue,${revenue}`,
      `Total Enrollments,${store.enrollmentApplications.length}`,
      `Attendance Rate,${attendanceRate}%`,
      '',
      'Month,Enrollments,Revenue',
      ...months.map((item) => `${item.key},${item.count},${item.paid}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hiraya-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const pie = statusSlices.reduce(
    (acc, slice) => {
      const start = acc.offset;
      acc.parts.push(`${slice.color} ${start}deg ${start + slice.pct * 3.6}deg`);
      acc.offset += slice.pct * 3.6;
      return acc;
    },
    { offset: 0, parts: [] as string[] },
  );

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Insights"
        title="Reports"
        description="Revenue, enrollment, and attendance at a glance — export a CSV for the board or thesis appendix."
        actions={
          <button type="button" className="dash-action dash-action-primary" onClick={exportCsv}>
            Download / Export Report
          </button>
        }
      />
      <div className="kpi-grid">
        <article className="kpi-card">
          <p className="kpi-label">Total Revenue</p>
          <strong className="kpi-value">₱{revenue.toLocaleString()}</strong>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Total Enrollments</p>
          <strong className="kpi-value">{store.enrollmentApplications.length}</strong>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Attendance Rate</p>
          <strong className="kpi-value">{attendanceRate}%</strong>
        </article>
        <article className="kpi-card">
          <p className="kpi-label">Active Students</p>
          <strong className="kpi-value">{store.students.filter((item) => item.status === 'active').length}</strong>
        </article>
      </div>

      <div className="chart-grid">
        <section className="hlc-card chart-panel">
          <h2>Enrollment trends</h2>
          <div className="chart-body">
            <svg className="trend-chart" viewBox="0 0 100 92" preserveAspectRatio="none" role="img" aria-label="Enrollments over six months">
              <polyline fill="none" stroke="#c9a227" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={points} />
            </svg>
            <div className="chart-legend">
              {months.map((item) => (
                <span key={item.key}>
                  {item.key.slice(5)} · {item.count}
                </span>
              ))}
            </div>
          </div>
        </section>
        <section className="hlc-card chart-panel">
          <h2>Revenue by month</h2>
          <ul className="bar-chart">
            {months.map((item) => (
              <li key={item.key}>
                <span className="bar-name">{item.key.slice(5)}</span>
                <span className="bar-track">
                  <i style={{ width: `${(item.paid / maxPay) * 100}%` }} />
                </span>
                <em className="bar-count">{item.paid}</em>
              </li>
            ))}
          </ul>
        </section>
        <section className="hlc-card chart-panel">
          <h2>Application mix</h2>
          <div className="pie-wrap">
            <div
              aria-hidden="true"
              style={{
                width: 160,
                height: 160,
                borderRadius: '50%',
                background: `conic-gradient(${pie.parts.join(', ')})`,
                flex: '0 0 160px',
              }}
            />
            <ul className="bar-chart">
              {statusSlices.map((slice) => (
                <li key={slice.name}>
                  <span className="bar-name">{slice.name}</span>
                  <span className="bar-track">
                    <i style={{ width: `${slice.pct}%`, background: slice.color }} />
                  </span>
                  <em className="bar-count">{slice.value}</em>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
