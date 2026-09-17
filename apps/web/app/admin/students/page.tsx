'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTable } from '@/components/admin/AdminTable';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, EmptyValue, Field, FieldLegend, Input, Loading, Select, StatusBadge, Textarea, emptyCell } from '@hiraya/ui';
import { confirmStudentPresentToday, isStudentHereToday, newId, studentDayAttendance, studentDisplay } from '@hiraya/utils';
import type { Student } from '@hiraya/types';
import { FormEvent, useEffect, useMemo, useState } from 'react';

function blankStudent(): Student {
  return {
    studentId: '',
    firstName: '',
    middleName: '',
    lastName: '',
    fullname: '',
    birthdate: '',
    age: 0,
    gender: '',
    address: '',
    contactNumber: '',
    parentId: '',
    emergencyContact: '',
    emergencyPhone: '',
    qrCode: '',
    gradeLevel: '',
    program: '',
    status: 'active',
    enrollmentDate: new Date().toISOString().slice(0, 10),
    notes: '',
  };
}

export default function AdminStudentsPage() {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'view' | 'edit' | 'delete' | null>(null);
  const [current, setCurrent] = useState<Student | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setQuery(q);
  }, []);

  const parents = store.users.filter((user) => user.role === 'parent');

  const rows = useMemo(
    () =>
      store.students.filter((student) => {
        const parent = parents.find((item) => item.userId === student.parentId);
        const hay = `${studentDisplay(student)} ${student.gradeLevel} ${student.program} ${student.emergencyContact} ${parent?.fullname || ''}`.toLowerCase();
        return hay.includes(query.toLowerCase());
      }),
    [store.students, parents, query],
  );

  function guardianText(student: Student) {
    const parent = parents.find((item) => item.userId === student.parentId);
    return parent?.fullname || student.emergencyContact || '';
  }

  function open(next: Student | null, nextMode: 'view' | 'edit' | 'delete') {
    setCurrent(next || blankStudent());
    setMode(nextMode);
  }

  async function markHereToday(row: Student) {
    if (isStudentHereToday(store, row.studentId)) {
      window.alert(`${studentDisplay(row)} is already marked as here today.`);
      return;
    }
    const name = studentDisplay(row);
    if (
      !window.confirm(
        `Confirm that ${name} is at the center today? This records attendance. If they have a session package, one session is used.`,
      )
    ) {
      return;
    }
    setBusyId(row.studentId);
    try {
      await save(confirmStudentPresentToday(store, row.studentId, user?.userId || ''));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not record attendance');
    } finally {
      setBusyId(null);
    }
  }

  function todayCell(row: Student) {
    const today = studentDayAttendance(store, row.studentId);
    if (isStudentHereToday(store, row.studentId)) {
      return <StatusBadge status={today?.status || 'present'} />;
    }
    if (today?.status) return <StatusBadge status={today.status} />;
    return (
      <button type="button" className="table-action" disabled={busyId === row.studentId} onClick={() => void markHereToday(row)}>
        Here today
      </button>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const form = new FormData(event.currentTarget);
    const next: Student = {
      ...current,
      studentId: current.studentId || newId('stu'),
      firstName: String(form.get('firstName') || ''),
      middleName: String(form.get('middleName') || ''),
      lastName: String(form.get('lastName') || ''),
      birthdate: String(form.get('birthdate') || ''),
      age: Number(form.get('age') || 0),
      gender: String(form.get('gender') || ''),
      contactNumber: String(form.get('contactNumber') || ''),
      emergencyContact: String(form.get('emergencyContact') || ''),
      gradeLevel: String(form.get('gradeLevel') || ''),
      program: String(form.get('program') || ''),
      status: String(form.get('status') || 'active'),
      notes: String(form.get('notes') || ''),
      parentId: String(form.get('parentId') || current.parentId || ''),
    };
    next.fullname = [next.firstName, next.middleName, next.lastName].filter(Boolean).join(' ');
    try {
      if (!next.parentId) {
        throw new Error('Link a parent account. Children do not sign in; parents use the app.');
      }
    const now = new Date().toISOString();
    const existingLink = store.parentStudents.find((l) => l.parentId === next.parentId && l.studentId === next.studentId);
    const parentStudents = [
      ...store.parentStudents.filter((l) => !(l.parentId === next.parentId && l.studentId === next.studentId)),
      {
        parentStudentId: existingLink?.parentStudentId || `ps_${Date.now().toString(36)}`,
        parentId: next.parentId,
        studentId: next.studentId,
        relationship: existingLink?.relationship || 'Guardian',
        isActive: true,
        createdAt: existingLink?.createdAt || now,
        updatedAt: now,
      },
    ];
    const students = store.students.some((item) => item.studentId === next.studentId)
      ? store.students.map((item) => (item.studentId === next.studentId ? next : item))
      : [...store.students, next];
    await save({ ...store, students, parentStudents });
    setMode(null);
    setCurrent(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not save student');
    }
  }

  async function remove() {
    if (!current?.studentId) return;
    await save({ ...store, students: store.students.filter((item) => item.studentId !== current.studentId) });
    setMode(null);
    setCurrent(null);
  }

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Management"
        title="Student management"
        description="Create learners, link each child to a parent, and mark who is at the center today. Present records attendance and uses one session from the child’s package."
        actions={
          <button type="button" className="dash-action dash-action-primary" onClick={() => open(blankStudent(), 'edit')}>
            + Add Student
          </button>
        }
      />
      <div className="admin-filter-bar">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this list of students" aria-label="Filter this list of students" />
      </div>
      <AdminTable
        rows={rows}
        rowKey={(row) => row.studentId}
        empty={<EmptyState title="No students" hint="Add a learner or adjust search." />}
        columns={[
          { key: 'name', header: 'Name', sortValue: (row) => studentDisplay(row), render: (row) => studentDisplay(row) },
          {
            key: 'grade',
            header: 'Age / Grade',
            sortValue: (row) => row.age || row.gradeLevel,
            render: (row) => [row.age ? `${row.age} yrs` : '', row.gradeLevel].filter(Boolean).join(' · ') || <EmptyValue />,
          },
          { key: 'guardian', header: 'Guardian', sortValue: (row) => guardianText(row), render: (row) => emptyCell(guardianText(row)) },
          { key: 'contact', header: 'Contact', sortValue: (row) => row.contactNumber, render: (row) => emptyCell(row.contactNumber) },
          {
            key: 'today',
            header: 'Today',
            sortValue: (row) => (isStudentHereToday(store, row.studentId) ? 'here' : studentDayAttendance(store, row.studentId)?.status || 'open'),
            render: (row) => todayCell(row),
          },
          { key: 'status', header: 'Status', sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="icon-actions">
                <button type="button" className="icon-btn" aria-label={`View ${studentDisplay(row)}`} onClick={() => open(row, 'view')}>
                  👁
                </button>
                <button type="button" className="icon-btn" aria-label={`Edit ${studentDisplay(row)}`} onClick={() => open(row, 'edit')}>
                  ✎
                </button>
                <button type="button" className="icon-btn danger" aria-label={`Delete ${studentDisplay(row)}`} onClick={() => open(row, 'delete')}>
                  ⌫
                </button>
              </div>
            ),
          },
        ]}
        renderCard={(row) => (
          <article className="admin-stack-card">
            <h3>{studentDisplay(row)}</h3>
            <p>
              {row.age ? `${row.age} yrs` : <EmptyValue />} · {row.gradeLevel || <EmptyValue />}
            </p>
            <p>{emptyCell(guardianText(row))}</p>
            <p>{emptyCell(row.contactNumber)}</p>
            {todayCell(row)}
            <StatusBadge status={row.status} />
            <div className="icon-actions">
              <button type="button" className="icon-btn" onClick={() => open(row, 'view')}>
                👁
              </button>
              <button type="button" className="icon-btn" onClick={() => open(row, 'edit')}>
                ✎
              </button>
              <button type="button" className="icon-btn danger" onClick={() => open(row, 'delete')}>
                ⌫
              </button>
            </div>
          </article>
        )}
      />

      {mode === 'view' && current ? (
        <AdminModal title={studentDisplay(current)} description="Learner profile" onClose={() => setMode(null)}>
          <p>
            <strong>Age / grade:</strong> {current.age || <EmptyValue />} / {current.gradeLevel || <EmptyValue />}
          </p>
          <p>
            <strong>Program:</strong> {emptyCell(current.program)}
          </p>
          <p>
            <strong>Guardian:</strong> {emptyCell(guardianText(current))}
          </p>
          <p>
            <strong>Contact:</strong> {emptyCell(current.contactNumber)}
          </p>
          <p>
            <strong>Status:</strong> {current.status}
          </p>
          <p>
            <strong>Today:</strong> {isStudentHereToday(store, current.studentId) ? 'Here' : studentDayAttendance(store, current.studentId)?.status || 'Not recorded'}
          </p>
          {!isStudentHereToday(store, current.studentId) ? (
            <Button type="button" onClick={() => void markHereToday(current)}>
              Mark here today
            </Button>
          ) : null}
        </AdminModal>
      ) : null}

      {mode === 'edit' && current ? (
        <AdminModal
          title={current.studentId ? `Edit ${studentDisplay(current)}` : 'Add student'}
          onClose={() => setMode(null)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button type="submit" form="student-form">
                Save
              </Button>
            </>
          }
        >
          <form id="student-form" className="form-grid" onSubmit={onSubmit}>
            <FieldLegend />
            <Field label="First name" required>
              <Input name="firstName" defaultValue={current.firstName} required />
            </Field>
            <Field label="Middle name" optional>
              <Input name="middleName" defaultValue={current.middleName} />
            </Field>
            <Field label="Last name" required>
              <Input name="lastName" defaultValue={current.lastName} required />
            </Field>
            <Field label="Birthdate" optional>
              <Input name="birthdate" type="date" defaultValue={current.birthdate} />
            </Field>
            <Field label="Age" optional>
              <Input name="age" type="number" defaultValue={current.age || 0} />
            </Field>
            <Field label="Grade / level" optional>
              <Input name="gradeLevel" defaultValue={current.gradeLevel} />
            </Field>
            <Field label="Program" optional>
              <Select name="program" defaultValue={current.program}>
                <option value="">Not assigned</option>
                {store.programs.map((program) => (
                  <option key={program.programId} value={program.name}>
                    {program.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Parent / guardian" optional>
              <Select name="parentId" defaultValue={current.parentId}>
                <option value="">Not assigned</option>
                {parents.map((parent) => (
                  <option key={parent.userId} value={parent.userId}>
                    {parent.fullname || parent.email}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Guardian name (if not linked)">
              <Input name="emergencyContact" defaultValue={current.emergencyContact} />
            </Field>
            <Field label="Contact">
              <Input name="contactNumber" defaultValue={current.contactNumber} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={current.status || 'active'}>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea name="notes" defaultValue={current.notes} />
            </Field>
          </form>
        </AdminModal>
      ) : null}

      {mode === 'delete' && current ? (
        <AdminModal
          title="Delete student"
          description={`Remove ${studentDisplay(current)} from the roster?`}
          onClose={() => setMode(null)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={() => void remove()}>
                Delete
              </Button>
            </>
          }
        >
          <p>This removes the learner record from the center database.</p>
        </AdminModal>
      ) : null}
    </>
  );
}
