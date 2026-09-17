'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTable } from '@/components/admin/AdminTable';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, emptyCell } from '@hiraya/ui';
import { completeOneSession, newId, normalizeSessionPackage, studentDisplay } from '@hiraya/utils';
import type { SessionPackage } from '@hiraya/types';
import { FormEvent, useState } from 'react';

export default function AdminSessionsPage() {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  const [editing, setEditing] = useState<SessionPackage | 'new' | null>(null);
  const [error, setError] = useState('');
  const rows = store.sessionPackages || [];
  const current = editing && editing !== 'new' ? editing : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const total = Math.max(0, Number(form.get('totalSessions') || 0));
    const used = Number(form.get('usedSessions') || 0);
    const next = normalizeSessionPackage({
      packageId: current?.packageId || newId('pkg'),
      studentId: String(form.get('studentId') || ''),
      programId: String(form.get('programId') || ''),
      totalSessions: total,
      usedSessions: used,
      remainingSessions: 0,
      startDate: String(form.get('startDate') || ''),
      expirationDate: String(form.get('expirationDate') || ''),
      status: String(form.get('status') || 'active'),
      createdAt: current?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (!next.studentId || total < 1) {
      setError('Student and total sessions are required.');
      return;
    }
    setError('');
    await save({
      ...store,
      sessionPackages: current ? rows.map((item) => (item.packageId === next.packageId ? next : item)) : [...rows, next],
    });
    setEditing(null);
  }

  async function completeOne(row: SessionPackage) {
    try {
      await save(completeOneSession(store, row.packageId, user?.userId || ''));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not complete session');
    }
  }

  if (loading) return <Loading />;
  return (
    <>
      <AdminPageHeader
        kicker="Management"
        title="Session management"
        description="Remaining sessions = total − used, never below zero. The same package is what parents see on mobile."
        actions={
          <button type="button" className="dash-action dash-action-primary" onClick={() => setEditing('new')}>
            + Add Package
          </button>
        }
      />
      <AdminTable
        rows={rows}
        rowKey={(row) => row.packageId}
        empty={<EmptyState title="No session packages" hint="Create a package with a total session count for a student." />}
        columns={[
          {
            key: 'student',
            header: 'Student',
            sortValue: (row) => {
              const student = store.students.find((item) => item.studentId === row.studentId);
              return student ? studentDisplay(student) : row.studentId;
            },
            render: (row) => {
              const student = store.students.find((item) => item.studentId === row.studentId);
              return student ? studentDisplay(student) : emptyCell(row.studentId);
            },
          },
          { key: 'remain', header: 'Remaining', sortValue: (row) => row.remainingSessions, render: (row) => String(row.remainingSessions) },
          { key: 'used', header: 'Used', sortValue: (row) => row.usedSessions, render: (row) => String(row.usedSessions) },
          { key: 'status', header: 'Status', sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="icon-actions">
                <button type="button" className="table-action" onClick={() => setEditing(row)}>
                  Edit
                </button>
                <button type="button" className="table-action" onClick={() => void completeOne(row)}>
                  Complete one
                </button>
              </div>
            ),
          },
        ]}
        renderCard={(row) => {
          const student = store.students.find((item) => item.studentId === row.studentId);
          return (
            <article className="admin-stack-card">
              <h3>{student ? studentDisplay(student) : row.studentId}</h3>
              <StatusBadge status={row.status} />
            </article>
          );
        }}
      />
      {editing ? (
        <AdminModal title={current ? 'Edit package' : 'Add package'} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={onSubmit}>
            {error ? <p className="hlc-field-error">{error}</p> : null}
            <Field label="Student" required>
              <Select name="studentId" defaultValue={current?.studentId || ''} required>
                <option value="">Select</option>
                {store.students.map((item) => (
                  <option key={item.studentId} value={item.studentId}>
                    {studentDisplay(item)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Program">
              <Select name="programId" defaultValue={current?.programId || ''}>
                <option value="">None</option>
                {store.programs.map((item) => (
                  <option key={item.programId} value={item.programId}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Total sessions" required>
              <Input name="totalSessions" type="number" min={1} defaultValue={current?.totalSessions || 10} required />
            </Field>
            <Field label="Used sessions">
              <Input name="usedSessions" type="number" min={0} defaultValue={current?.usedSessions || 0} />
            </Field>
            <Field label="Start">
              <Input name="startDate" type="date" defaultValue={current?.startDate} />
            </Field>
            <Field label="Expires">
              <Input name="expirationDate" type="date" defaultValue={current?.expirationDate} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={current?.status || 'active'}>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="expired">expired</option>
              </Select>
            </Field>
            <Button type="submit">Save package</Button>
          </form>
        </AdminModal>
      ) : null}
    </>
  );
}
