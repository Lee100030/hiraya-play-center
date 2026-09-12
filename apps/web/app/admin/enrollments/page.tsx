'use client';

import { useStore } from '@/components/StoreProvider';
import { enrollmentStatusLabel } from '@/lib/enrollment';
import { Alert, Button, EmptyState, Input, Loading, Select, StatusBadge, Table } from '@hiraya/ui';
import type { EnrollmentApplication } from '@hiraya/types';
import { useMemo, useState } from 'react';

export default function AdminEnrollmentsPage() {
  const { store, loading, save } = useStore();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<EnrollmentApplication | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(() => {
    return store.enrollmentApplications.filter((row) => {
      const haystack = `${row.studentFullname} ${row.parentFullname} ${row.parentEmail} ${row.preferredProgram}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const current = enrollmentStatusLabel(row.status).toLowerCase();
      const matchesStatus = status === 'all' || current === status;
      return matchesQuery && matchesStatus;
    });
  }, [store.enrollmentApplications, query, status]);

  async function setStatusFor(id: string, next: string) {
    const label = enrollmentStatusLabel(next);
    if (!window.confirm(`${label} this enrollment application?`)) return;
    await save({
      ...store,
      enrollmentApplications: store.enrollmentApplications.map((row) =>
        row.applicationId === id ? { ...row, status: next } : row,
      ),
    });
    setSelected((current) => (current?.applicationId === id ? { ...current, status: next } : current));
    setMessage(`Application ${label.toLowerCase()}.`);
  }

  if (loading) return <Loading />;

  return (
    <>
      <h1>Enrollments</h1>
      <p>Review public applications submitted from the website.</p>
      {message ? <Alert kind="success">{message}</Alert> : null}
      <div className="toolbar">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search student, parent, or program"
        />
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No enrollments" hint="Submitted applications will appear here." />
      ) : (
        <>
          <div className="admin-table-wrap">
            <Table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Program</th>
                  <th>Contact</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.applicationId}>
                    <td>{row.studentFullname}</td>
                    <td>{row.preferredProgram}</td>
                    <td>
                      {row.parentPhone}
                      <br />
                      {row.parentEmail}
                    </td>
                    <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—'}</td>
                    <td>
                      <StatusBadge status={enrollmentStatusLabel(row.status)} />
                    </td>
                    <td>
                      <Button type="button" variant="ghost" onClick={() => setSelected(row)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="admin-card-list">
            {rows.map((row) => (
              <article key={row.applicationId} className="hlc-card">
                <h2>{row.studentFullname}</h2>
                <p>{row.preferredProgram}</p>
                <p>{row.parentEmail}</p>
                <StatusBadge status={enrollmentStatusLabel(row.status)} />
                <Button type="button" onClick={() => setSelected(row)}>
                  View details
                </Button>
              </article>
            ))}
          </div>
        </>
      )}

      {selected ? (
        <div className="enroll-overlay" onClick={() => setSelected(null)} role="presentation">
          <div className="enroll-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="enroll-modal-close" onClick={() => setSelected(null)} aria-label="Close">
              ×
            </button>
            <header className="enroll-modal-head">
              <h2>{selected.studentFullname}</h2>
              <p className="enroll-modal-school">{selected.preferredProgram}</p>
            </header>
            <div className="enroll-modal-form">
              <p>
                <strong>Date of birth:</strong> {selected.studentBirthdate || '—'}
              </p>
              <p>
                <strong>Age:</strong> {selected.studentAge || '—'}
              </p>
              <p>
                <strong>Gender:</strong> {selected.studentGender || '—'}
              </p>
              <p>
                <strong>Parent / guardian:</strong> {selected.parentFullname}
              </p>
              <p>
                <strong>Parent contact:</strong> {selected.parentPhone}
              </p>
              <p>
                <strong>Parent email:</strong> {selected.parentEmail}
              </p>
              <p>
                <strong>Submitted:</strong> {selected.submittedAt ? new Date(selected.submittedAt).toLocaleString() : '—'}
              </p>
              <p>
                <strong>Status:</strong> {enrollmentStatusLabel(selected.status)}
              </p>
              {selected.notes ? (
                <pre className="admin-notes">{selected.notes}</pre>
              ) : null}
              <div className="enroll-modal-actions">
                {selected.status === 'pending_review' || selected.status === 'pending' ? (
                  <>
                    <Button type="button" onClick={() => setStatusFor(selected.applicationId, 'approved')}>
                      Approve
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setStatusFor(selected.applicationId, 'rejected')}>
                      Reject
                    </Button>
                    <Button type="button" variant="danger" onClick={() => setStatusFor(selected.applicationId, 'cancelled')}>
                      Cancel
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
