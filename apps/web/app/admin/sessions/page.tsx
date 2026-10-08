'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { LaneSessionPackage } from '@/components/admin/LaneSessionPackage';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTable } from '@/components/admin/AdminTable';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, emptyCell } from '@hiraya/ui';
import {
  completeOneSession,
  compareStudentNames,
  dropStudentSessionPackage,
  laneLabel,
  newId,
  normalizeSessionPackage,
  parsePeopleLane,
  placeStudentSessionPackage,
  scrubLeftoverSessionPackages,
  sessionLeftFor,
  studentDisplay,
  studentSessionPackage,
  studentInLane,
} from '@hiraya/utils';
import type { SessionPackage, Student } from '@hiraya/types';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type SessionRow = {
  student: Student;
  pack: ReturnType<typeof sessionLeftFor>;
  latest: SessionPackage | null;
};

export default function AdminSessionsPage() {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  const lane = parsePeopleLane(useSearchParams().get('lane'), store);
  const [editing, setEditing] = useState<SessionPackage | 'new' | null>(null);
  const [error, setError] = useState('');
  const scrubbedPackages = useRef(false);
  useEffect(() => {
    if (loading || scrubbedPackages.current) return;
    const next = scrubLeftoverSessionPackages(store);
    if (!next) return;
    scrubbedPackages.current = true;
    void save(next).catch(() => {
      scrubbedPackages.current = false;
    });
  }, [loading, store, save]);
  const studentOptions = useMemo(
    () => store.students.filter((item) => studentInLane(store, item, lane)).sort(compareStudentNames),
    [store, lane],
  );
  const rows: SessionRow[] = useMemo(
    () =>
      studentOptions.map((student) => {
        const pack = sessionLeftFor(store, student.studentId);
        const latest = studentSessionPackage(store, student.studentId);
        return { student, pack, latest };
      }),
    [studentOptions, store],
  );
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
    await save(placeStudentSessionPackage(store, next));
    setEditing(null);
  }

  async function deletePackage(row: SessionRow) {
    if (!row.latest) {
      window.alert('This student has no session package to delete.');
      return;
    }
    if (
      !window.confirm(
        `Delete the session package for ${studentDisplay(row.student)}? Counted payments for this student will also leave Income and expenses.`,
      )
    ) {
      return;
    }
    try {
      await save(dropStudentSessionPackage(store, row.student.studentId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete package');
    }
  }

  async function completeOne(row: SessionRow) {
    if (!row.latest) {
      window.alert('Add a session package for this student first.');
      return;
    }
    try {
      await save(completeOneSession(store, row.latest.packageId, user?.userId || ''));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not complete session');
    }
  }

  function openEdit(row: SessionRow) {
    if (row.latest) {
      setEditing(row.latest);
      return;
    }
    setEditing('new');
  }

  if (loading) return <Loading />;
  return (
    <>
      <AdminPageHeader
        kicker="Management"
        title={lane ? `Session management · ${laneLabel(lane, store)}` : 'Session management'}
        description={
          lane
            ? `Sessions left for each learner in ${laneLabel(lane, store)}.`
            : 'See how many sessions each student has left. Remaining = total − used, never below zero.'
        }
        actions={
          <button type="button" className="dash-action dash-action-primary" onClick={() => setEditing('new')}>
            + Add Package
          </button>
        }
      />
      {lane ? <LaneSessionPackage lane={lane} /> : null}
      <AdminTable
        rows={rows}
        rowKey={(row) => row.student.studentId}
        empty={<EmptyState title="No students in this list" hint="Add learners in Student management, or pick another program lane." />}
        columns={[
          {
            key: 'student',
            header: 'Student',
            sortValue: (row) => studentDisplay(row.student),
            render: (row) => studentDisplay(row.student),
          },
          {
            key: 'left',
            header: 'Sessions left',
            sortValue: (row) => row.pack.remaining,
            render: (row) =>
              row.pack.hasPackage
                ? `${row.pack.remaining} session${row.pack.remaining === 1 ? '' : 's'} left`
                : emptyCell('No package'),
          },
          {
            key: 'used',
            header: 'Used',
            sortValue: (row) => row.pack.used,
            render: (row) => (row.pack.hasPackage ? String(row.pack.used) : emptyCell('')),
          },
          {
            key: 'total',
            header: 'Total',
            sortValue: (row) => row.pack.total,
            render: (row) => (row.pack.hasPackage ? String(row.pack.total) : emptyCell('')),
          },
          {
            key: 'status',
            header: 'Status',
            sortValue: (row) => row.latest?.status || '',
            render: (row) =>
              row.latest ? <StatusBadge status={row.latest.status} /> : emptyCell(row.pack.hasPackage ? 'active' : ''),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="icon-actions">
                <button type="button" className="table-action" onClick={() => openEdit(row)}>
                  {row.latest ? 'Edit' : 'Add package'}
                </button>
                <button type="button" className="table-action" onClick={() => void completeOne(row)}>
                  Complete one
                </button>
                {row.latest ? (
                  <button type="button" className="table-action" onClick={() => void deletePackage(row)}>
                    Delete
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
        renderCard={(row) => (
          <article className="admin-stack-card">
            <h3>{studentDisplay(row.student)}</h3>
            <p>
              {row.pack.hasPackage
                ? `${row.pack.remaining} session${row.pack.remaining === 1 ? '' : 's'} left`
                : 'No package yet'}
            </p>
            {row.latest ? <StatusBadge status={row.latest.status} /> : null}
            <div className="icon-actions">
              <button type="button" className="icon-btn" onClick={() => openEdit(row)}>
                {row.latest ? 'Edit' : 'Add package'}
              </button>
              <button type="button" className="icon-btn" onClick={() => void completeOne(row)}>
                Complete one
              </button>
              {row.latest ? (
                <button type="button" className="icon-btn" onClick={() => void deletePackage(row)}>
                  Delete
                </button>
              ) : null}
            </div>
          </article>
        )}
      />
      {editing ? (
        <AdminModal title={current ? 'Edit package' : 'Add package'} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={onSubmit}>
            {error ? <p className="hlc-field-error">{error}</p> : null}
            <Field label="Student" required>
              <Select name="studentId" defaultValue={current?.studentId || ''} required>
                <option value="">Select</option>
                {studentOptions.map((item) => {
                  const left = sessionLeftFor(store, item.studentId);
                  return (
                    <option key={item.studentId} value={item.studentId}>
                      {studentDisplay(item)}
                      {left.hasPackage ? ` · ${left.remaining} sessions left` : ''}
                    </option>
                  );
                })}
                {current?.studentId && !studentOptions.some((item) => item.studentId === current.studentId)
                  ? (() => {
                      const student = store.students.find((item) => item.studentId === current.studentId);
                      return student ? (
                        <option key={student.studentId} value={student.studentId}>
                          {studentDisplay(student)}
                        </option>
                      ) : (
                        <option value={current.studentId}>{current.studentId}</option>
                      );
                    })()
                  : null}
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
