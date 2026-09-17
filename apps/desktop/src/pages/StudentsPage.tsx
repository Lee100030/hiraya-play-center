import type { HirayaDatabase, HirayaUser, Student } from '@hiraya/types';
import { confirmStudentPresentToday, displayName, isStudentHereToday, studentDayAttendance, studentDisplay } from '@hiraya/utils';
import { Field, Input, Select } from '@hiraya/ui';
import { FormEvent, useState } from 'react';
import { EditorModal, FormSection } from '../components/EditorModal';
import { EmptyCell, NameCell, RecordTable, StatusCell, assigned } from '../components/RecordTable';
import {
  ageFromBirthdate,
  parentOptions,
  remainingSessionsFor,
  studentPlacement,
  studentRecord,
  withParentLink,
} from '../lib/crud';
import { PAGE_COPY } from '../lib/views';

export function StudentsPage({
  store,
  saveStore,
  onRefresh,
  actor,
}: {
  store: HirayaDatabase;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
  actor?: HirayaUser;
}) {
  const [editing, setEditing] = useState<Student | null | 'new'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = editing && editing !== 'new' ? editing : null;

  async function persist(next: HirayaDatabase, message: string) {
    await saveStore(next);
    setNotice(message);
    setEditing(null);
  }

  async function markHereToday(row: Student) {
    if (isStudentHereToday(store, row.studentId)) {
      setNotice(`${studentDisplay(row)} is already marked as here today.`);
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
    setBusy(true);
    setError(null);
    try {
      await saveStore(confirmStudentPresentToday(store, row.studentId, actor?.userId || ''));
      setNotice(`${name} is marked as here today.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record attendance');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const birthdate = String(form.get('birthdate') || '');
    const parentId = String(form.get('parentId') || '');
    const slot = String(form.get('slot') || '').trim();
    const next = studentRecord({
      ...(current || {}),
      firstName: String(form.get('firstName') || ''),
      middleName: String(form.get('middleName') || ''),
      lastName: String(form.get('lastName') || ''),
      birthdate,
      age: ageFromBirthdate(birthdate),
      gender: String(form.get('gender') || ''),
      program: String(form.get('program') || ''),
      contactNumber: String(form.get('contactNumber') || ''),
      address: String(form.get('address') || ''),
      parentId,
      status: String(form.get('status') || 'active'),
      notes: String(form.get('notes') || ''),
    });
    const students = current
      ? store.students.map((item) => (item.studentId === next.studentId ? next : item))
      : [...store.students, next];
    setBusy(true);
    setError(null);
    try {
      if (!parentId) throw new Error('Link a parent account. Children do not sign in; parents use the app.');
      const ops = store.studentOps.filter((item) => item.studentId !== next.studentId);
      const currentOps = store.studentOps.find((item) => item.studentId === next.studentId);
      await persist(
        {
          ...store,
          students,
          studentOps: [
            ...ops,
            {
              studentId: next.studentId,
              paymentStatus: currentOps?.paymentStatus || '',
              collector: currentOps?.collector || '',
              hasIdCard: currentOps?.hasIdCard || false,
              hasFetcherId: currentOps?.hasFetcherId || false,
              hasNametag: currentOps?.hasNametag || false,
              feeAmount: currentOps?.feeAmount || 0,
              laceAmount: currentOps?.laceAmount || 0,
              currentSlot: slot,
              package: currentOps?.package || '',
            },
          ],
          parentStudents: parentId ? withParentLink(store, parentId, next.studentId) : store.parentStudents,
        },
        current ? 'Student saved.' : 'Student created.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save student');
    } finally {
      setBusy(false);
    }
  }

  async function archiveRows(rows: Student[]) {
    if (!rows.length) return false;
    const names = rows.map(studentDisplay).join(', ');
    if (!window.confirm(`Archive ${rows.length === 1 ? names : `${rows.length} students`}? They stay in history and can be restored.`)) {
      return false;
    }
    const ids = new Set(rows.map((row) => row.studentId));
    await persist(
      {
        ...store,
        students: store.students.map((item) =>
          ids.has(item.studentId) && item.status === 'active' ? { ...item, status: 'archived' } : item,
        ),
      },
      rows.length === 1 ? 'Student archived.' : `${rows.length} students archived.`,
    );
  }

  async function removeRows(rows: Student[]) {
    if (!rows.length) return false;
    if (
      !window.confirm(
        `Delete ${rows.length === 1 ? studentDisplay(rows[0]) : `${rows.length} students`} and related class enrollments? Prefer Archive unless this was added by mistake.`,
      )
    ) {
      return false;
    }
    const ids = new Set(rows.map((row) => row.studentId));
    await persist(
      {
        ...store,
        students: store.students.filter((item) => !ids.has(item.studentId)),
        enrollments: store.enrollments.filter((item) => !ids.has(item.studentId)),
        parentStudents: store.parentStudents.filter((item) => !ids.has(item.studentId)),
      },
      rows.length === 1 ? 'Student deleted.' : `${rows.length} students deleted.`,
    );
  }

  return (
    <>
      {notice ? (
        <p className="crud-notice" role="status" style={{ color: '#1f6b3a' }}>
          {notice}
        </p>
      ) : null}
      {error && !editing ? (
        <p className="crud-notice crud-notice-error" role="alert">
          {error}
        </p>
      ) : null}
      <RecordTable
        title={PAGE_COPY.students.title}
        description={PAGE_COPY.students.description}
        rows={store.students}
        rowKey={(row) => row.studentId}
        search={(row, q) =>
          `${studentDisplay(row)} ${row.studentId} ${row.program} ${row.contactNumber}`.toLowerCase().includes(q)
        }
        searchPlaceholder="Filter this list of students"
        emptyTitle="No students found"
        emptyHint="Add a student, or approve an enrollment application to create one automatically."
        statusOf={(row) => row.status}
        crud={{
          addLabel: '+ Add Student',
          onAdd: () => {
            setNotice(null);
            setEditing('new');
          },
          onEdit: (row) => {
            setNotice(null);
            setEditing(row);
          },
          onArchive: archiveRows,
          onDelete: removeRows,
          onRefresh,
          singleActions: [
            {
              label: 'Here today',
              icon: 'check',
              needOneMessage: 'Select one student to mark as here today.',
              onClick: (row) => void markHereToday(row),
            },
          ],
        }}
        columns={[
          { key: 'name', header: 'Student name', render: (row) => <NameCell name={studentDisplay(row)} /> },
          { key: 'number', header: 'Student number', render: (row) => assigned(row.studentId) },
          {
            key: 'parent',
            header: 'Parent / guardian',
            render: (row) => assigned(displayName(store.users.find((item) => item.userId === row.parentId))),
          },
          {
            key: 'program',
            header: 'Program',
            render: (row) => assigned(studentPlacement(store, row.studentId).programName || row.program),
          },
          {
            key: 'class',
            header: 'Class',
            priority: 'secondary',
            render: (row) => assigned(studentPlacement(store, row.studentId).className),
          },
          {
            key: 'teacher',
            header: 'Assigned teacher',
            render: (row) => assigned(studentPlacement(store, row.studentId).teacherName),
          },
          {
            key: 'today',
            header: 'Today',
            render: (row) => {
              const today = studentDayAttendance(store, row.studentId);
              if (isStudentHereToday(store, row.studentId)) {
                return <StatusCell value={today?.status || 'present'} />;
              }
              if (today?.status) return <StatusCell value={today.status} />;
              return (
                <button
                  type="button"
                  className="linkish"
                  disabled={busy}
                  onClick={(event) => {
                    event.stopPropagation();
                    void markHereToday(row);
                  }}
                >
                  Mark here today
                </button>
              );
            },
          },
          {
            key: 'sessions',
            header: 'Sessions remaining',
            priority: 'secondary',
            render: (row) => {
              const left = remainingSessionsFor(store, row.studentId);
              return left == null ? <EmptyCell /> : String(left);
            },
          },
          {
            key: 'enroll',
            header: 'Enrollment',
            render: (row) => <StatusCell value={studentPlacement(store, row.studentId).enrollmentStatus} />,
          },
          { key: 'status', header: 'Student status', render: (row) => <StatusCell value={row.status} /> },
        ]}
      />
      {editing ? (
        <EditorModal
          title={current ? `Edit ${studentDisplay(current)}` : 'Add student'}
          error={error}
          busy={busy}
          submitLabel={current ? 'Save student' : 'Create student'}
          onClose={() => setEditing(null)}
          onSubmit={onSubmit}
        >
          <FormSection title="Student info">
            <Field label="Last name" required>
              <Input name="lastName" defaultValue={current?.lastName} required />
            </Field>
            <Field label="First name" required>
              <Input name="firstName" defaultValue={current?.firstName} required />
            </Field>
            <Field label="Middle name" optional>
              <Input name="middleName" defaultValue={current?.middleName} />
            </Field>
            <Field label="Student number" optional hint="Assigned automatically on save if empty.">
              <Input value={current?.studentId || 'Assigned on save'} readOnly />
            </Field>
            <Field label="Boy / Girl" optional>
              <Select name="gender" defaultValue={current?.gender || ''}>
                <option value="">Not provided</option>
                <option value="male">Boy</option>
                <option value="female">Girl</option>
              </Select>
            </Field>
            <Field label="Birthday" optional>
              <Input name="birthdate" type="date" defaultValue={current?.birthdate} />
            </Field>
            <Field label="Address" optional>
              <Input name="address" defaultValue={current?.address} />
            </Field>
            <Field label="Contact number" optional>
              <Input name="contactNumber" defaultValue={current?.contactNumber} />
            </Field>
          </FormSection>
          <FormSection title="Placement">
            <Field label="Slot" optional>
              <Input name="slot" defaultValue={store.studentOps.find((item) => item.studentId === current?.studentId)?.currentSlot || ''} />
            </Field>
            <Field label="Program" optional>
              <Select name="program" defaultValue={current?.program || ''}>
                <option value="">Select program</option>
                {store.programs.map((program) => (
                  <option key={program.programId} value={program.name}>
                    {program.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Parent / guardian" required>
              <Select name="parentId" defaultValue={current?.parentId || ''} required>
                <option value="">Select parent</option>
                {parentOptions(store).map((parent) => (
                  <option key={parent.userId} value={parent.userId}>
                    {displayName(parent)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Student status">
              <Select name="status" defaultValue={current?.status || 'active'}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <div className="form-span">
              <Field label="Notes" optional>
                <Input name="notes" defaultValue={current?.notes} />
              </Field>
            </div>
          </FormSection>
        </EditorModal>
      ) : null}
    </>
  );
}
