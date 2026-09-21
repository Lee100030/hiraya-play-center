import { FormEvent, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  emptyCell,
} from '@hiraya/ui';
import { displayName, newId, roleLabel, studentDisplay, CENTER_PROGRAMS } from '@hiraya/utils';
import type { HirayaDatabase, HirayaUser, Student } from '@hiraya/types';
import type { ViewId } from '../lib/views';
import { StaffTasksBlock } from './AdminPhase2';

function childrenOf(store: HirayaDatabase, parentId: string) {
  const ids = new Set(
    store.parentStudents.filter((l) => l.parentId === parentId && l.isActive).map((l) => l.studentId),
  );
  if (ids.size === 0) {
    return store.students.filter((s) => s.parentId === parentId);
  }
  return store.students.filter((s) => ids.has(s.studentId) || s.parentId === parentId);
}

export function StudentsPage({
  store,
  loading,
  onSave,
}: {
  store: HirayaDatabase;
  loading: boolean;
  onSave: (next: HirayaDatabase) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<Student | null>(null);
  const [tab, setTab] = useState<'schedule' | 'attendance' | 'payments' | 'documents' | 'certificates' | 'notes'>('schedule');

  const rows = useMemo(
    () =>
      store.students.filter((s) => studentDisplay(s).toLowerCase().includes(query.toLowerCase())),
    [store.students, query],
  );

  if (loading) return <Loading />;

  async function persist(next: HirayaDatabase) {
    setBusy(true);
    setError('');
    try {
      await onSave(next);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Student = {
      studentId: editing?.studentId || newId('stu'),
      firstName: String(form.get('firstName') || ''),
      middleName: String(form.get('middleName') || ''),
      lastName: String(form.get('lastName') || ''),
      nickname: String(form.get('nickname') || ''),
      fullname: '',
      birthdate: String(form.get('birthdate') || ''),
      age: Number(form.get('age') || 0),
      gender: String(form.get('gender') || ''),
      address: String(form.get('address') || ''),
      contactNumber: String(form.get('contactNumber') || ''),
      parentId: String(form.get('parentId') || editing?.parentId || ''),
      emergencyContact: String(form.get('emergencyContact') || ''),
      emergencyPhone: String(form.get('emergencyPhone') || ''),
      qrCode: editing?.qrCode || '',
      gradeLevel: String(form.get('gradeLevel') || ''),
      program: String(form.get('program') || ''),
      status: String(form.get('status') || 'active'),
      enrollmentDate: editing?.enrollmentDate || new Date().toISOString().slice(0, 10),
      notes: String(form.get('notes') || ''),
    };
    next.fullname = [next.firstName, next.middleName, next.lastName].filter(Boolean).join(' ');
    const students = editing
      ? store.students.map((s) => (s.studentId === next.studentId ? next : s))
      : [...store.students, next];
    await persist({ ...store, students });
  }

  async function archiveSelected() {
    const ids = new Set(selected);
    await persist({
      ...store,
      students: store.students.map((s) => (ids.has(s.studentId) ? { ...s, status: 'archived' } : s)),
    });
    setSelected([]);
  }

  return (
    <>
      <PageHeader
        crumb="Students"
        kicker="Management"
        title="Students"
        description="Create, edit, and archive learners. Counts come from the local hub."
        actions={
          <>
            <Button type="button" onClick={() => setEditing({} as Student)}>
              + Add
            </Button>
            <Button type="button" variant="ghost" disabled={selected.length !== 1} onClick={() => {
              const row = rows.find((s) => s.studentId === selected[0]);
              if (row) setEditing(row);
            }}>
              Edit
            </Button>
            <Button type="button" variant="danger" disabled={!selected.length} onClick={() => void archiveSelected()}>
              Archive
            </Button>
          </>
        }
      />
      <div className="toolbar">
        <Input placeholder="Search students" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {error ? <p className="hlc-alert hlc-alert-danger">{error}</p> : null}
      {rows.length === 0 ? (
        <EmptyState title="No records found." hint="+ Add a student." />
      ) : (
        <div className="hlc-gallery">
          {rows.map((row) => (
            <button
              key={row.studentId}
              type="button"
              className={`hlc-card hlc-person-card${selected.includes(row.studentId) ? ' is-selected' : ''}`}
              onClick={() => setProfile(row)}
              onDoubleClick={() => setEditing(row)}
            >
              <Avatar name={studentDisplay(row)} />
              <h3>{studentDisplay(row)}</h3>
              <p>{emptyCell(row.program)}</p>
              <StatusBadge status={row.status} />
            </button>
          ))}
        </div>
      )}
      {editing ? (
        <Modal
          title={editing.studentId ? 'Edit student' : 'Add student'}
          onClose={() => !busy && setEditing(null)}
          busy={busy}
          actions={
            <>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" form="student-form" disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </>
          }
        >
          <form id="student-form" className="form-grid" onSubmit={(e) => void onSubmit(e)}>
            <Field label="First name">
              <Input name="firstName" defaultValue={editing.firstName} required />
            </Field>
            <Field label="Last name">
              <Input name="lastName" defaultValue={editing.lastName} required />
            </Field>
            <Field label="Nickname">
              <Input name="nickname" defaultValue={editing.nickname} />
            </Field>
            <Field label="Program">
              <Select name="program" defaultValue={editing.program}>
                {CENTER_PROGRAMS.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Parent">
              <Select name="parentId" defaultValue={editing.parentId || ''}>
                <option value="">Not assigned</option>
                {store.users
                  .filter((u) => u.role === 'parent')
                  .map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {displayName(u)}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Contact">
              <Input name="contactNumber" defaultValue={editing.contactNumber} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={editing.status || 'active'}>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </Select>
            </Field>
          </form>
        </Modal>
      ) : null}
      {profile ? (
        <Modal
          title={studentDisplay(profile)}
          onClose={() => setProfile(null)}
          actions={
            <Button type="button" variant="ghost" onClick={() => setProfile(null)}>
              Close
            </Button>
          }
        >
          <div className="desk-split">
            <Avatar name={studentDisplay(profile)} size={96} />
            <div>
              <p>Nickname {emptyCell(profile.nickname)}</p>
              <p>Age {profile.age || 'Not assigned'}</p>
              <p>Birthday {emptyCell(profile.birthdate)}</p>
              <p>Program {emptyCell(profile.program)}</p>
              <p>Start {emptyCell(profile.enrollmentDate)}</p>
              <StatusBadge status={profile.status} />
            </div>
          </div>
          <div className="hlc-toolbar" style={{ margin: '12px 0' }}>
            {(['schedule', 'attendance', 'payments', 'documents', 'certificates', 'notes'] as const).map((id) => (
              <Button key={id} type="button" variant={tab === id ? 'primary' : 'ghost'} onClick={() => setTab(id)}>
                {id}
              </Button>
            ))}
          </div>
          {tab === 'schedule' ? (
            store.schedules.filter((s) => s.studentId === profile.studentId).length ? (
              store.schedules
                .filter((s) => s.studentId === profile.studentId)
                .map((s) => (
                  <p key={s.scheduleId}>
                    {s.startAt} · {emptyCell(s.title)}
                  </p>
                ))
            ) : (
              <p className="hlc-muted">No records found.</p>
            )
          ) : null}
          {tab === 'attendance' ? (
            store.attendance.filter((a) => a.studentId === profile.studentId).length ? (
              store.attendance
                .filter((a) => a.studentId === profile.studentId)
                .slice(0, 12)
                .map((a) => (
                  <p key={a.attendanceId}>
                    {a.attendanceDate} · <StatusBadge status={a.status} />
                  </p>
                ))
            ) : (
              <p className="hlc-muted">No records found.</p>
            )
          ) : null}
          {tab === 'payments' ? (
            store.payments.filter((p) => p.studentId === profile.studentId).length ? (
              store.payments
                .filter((p) => p.studentId === profile.studentId)
                .map((p) => (
                  <p key={p.paymentId}>
                    ₱{p.amount} · <StatusBadge status={p.paymentStatus} />
                  </p>
                ))
            ) : (
              <p className="hlc-muted">No records found.</p>
            )
          ) : null}
          {tab === 'documents' ? (
            store.formSubmissions.filter((s) => s.studentId === profile.studentId).length ? (
              store.formSubmissions
                .filter((s) => s.studentId === profile.studentId)
                .map((s) => {
                  const form = store.centerForms.find((f) => f.formId === s.formId);
                  return (
                    <p key={s.submissionId}>
                      {form?.title || s.formId} · <StatusBadge status={s.status} />
                    </p>
                  );
                })
            ) : (
              <p className="hlc-muted">Requirement files attach from enrollment and Forms.</p>
            )
          ) : null}
          {tab === 'certificates' ? (
            store.certificateRequests.filter((c) => c.studentId === profile.studentId).length ? (
              store.certificateRequests
                .filter((c) => c.studentId === profile.studentId)
                .map((c) => (
                  <p key={c.requestId}>
                    {emptyCell(c.certificateType)} · {emptyCell(c.program)} · <StatusBadge status={c.status} />
                  </p>
                ))
            ) : (
              <p className="hlc-muted">No records found. Requests appear from Certificates.</p>
            )
          ) : null}
          {tab === 'notes' ? <p>{emptyCell(profile.notes)}</p> : null}
        </Modal>
      ) : null}
    </>
  );
}

export function ParentsPage({
  store,
  loading,
  onSave,
}: {
  store: HirayaDatabase;
  loading: boolean;
  onSave: (next: HirayaDatabase) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const rows = store.users.filter(
    (u) => u.role === 'parent' && displayName(u).toLowerCase().includes(query.toLowerCase()),
  );
  if (loading) return <Loading />;
  return (
    <>
      <PageHeader kicker="Management" crumb="Parents" title="Parents" description="Guardians and linked children." />
      <Input placeholder="Search parents" value={query} onChange={(e) => setQuery(e.target.value)} />
      {rows.length === 0 ? (
        <EmptyState title="No records found." hint="Parent accounts appear after enrollment or staff create them." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Parent</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Linked children</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.userId}>
                <td>
                  <Avatar name={displayName(row)} photo={row.profileImagePath} size={32} /> {displayName(row)}
                </td>
                <td>{emptyCell(row.phone)}</td>
                <td>{emptyCell(row.email)}</td>
                <td>{emptyCell(childrenOf(store, row.userId).map(studentDisplay).join(', '))}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

export function TeachersPage({
  store,
  loading,
  onOpen,
  onSave,
}: {
  store: HirayaDatabase;
  loading: boolean;
  onOpen: (user: HirayaUser) => void;
  onSave?: (next: HirayaDatabase) => Promise<void>;
}) {
  const people = store.users.filter((u) => ['teacher', 'staff', 'admin', 'super_admin'].includes(u.role));
  const [profile, setProfile] = useState<HirayaUser | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;

  async function setActive(row: HirayaUser, active: boolean) {
    if (!onSave) return;
    setBusy(true);
    try {
      await onSave({
        ...store,
        users: store.users.map((u) => (u.userId === row.userId ? { ...u, status: active ? 'active' : 'inactive' } : u)),
      });
      setProfile({ ...row, status: active ? 'active' : 'inactive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        crumb="Teachers"
        kicker="Management"
        title="Teachers"
        description="Open a card for the teacher profile. Set Active / Inactive here."
      />
      {people.length === 0 ? (
        <EmptyState title="No records found." />
      ) : (
        <div className="hlc-gallery">
          {people.map((person) => (
            <button key={person.userId} type="button" className="hlc-card hlc-person-card" onClick={() => setProfile(person)}>
              <Avatar name={displayName(person)} photo={person.profileImagePath} />
              <h3>{displayName(person)}</h3>
              <p>{roleLabel(person.role)}</p>
              <p>{emptyCell(store.teacherProfiles.find((p) => p.userId === person.userId)?.specialty)}</p>
              <StatusBadge status={person.status} />
            </button>
          ))}
        </div>
      )}
      {profile ? (
        <Modal
          title={displayName(profile)}
          onClose={() => setProfile(null)}
          busy={busy}
          actions={
            <>
              <Button type="button" variant="ghost" onClick={() => setProfile(null)}>
                Close
              </Button>
              <Button type="button" onClick={() => onOpen(profile)}>
                Open workspace
              </Button>
            </>
          }
        >
          <div className="desk-split">
            <Avatar name={displayName(profile)} photo={profile.profileImagePath} size={96} />
            <div>
              <p>{emptyCell(profile.email)}</p>
              <p>{emptyCell(profile.phone)}</p>
              <p>{emptyCell(profile.position)}</p>
              <StatusBadge status={profile.status} />
            </div>
          </div>
          <div className="hlc-toolbar" style={{ marginTop: 16 }}>
            <Button type="button" disabled={busy} onClick={() => void setActive(profile, true)}>
              Active
            </Button>
            <Button type="button" variant="danger" disabled={busy} onClick={() => void setActive(profile, false)}>
              Inactive
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export function TeacherWorkspace({
  store,
  teacher,
  onBack,
  onSave,
}: {
  store: HirayaDatabase;
  teacher: HirayaUser;
  onBack: () => void;
  onSave?: (next: HirayaDatabase) => Promise<void>;
}) {
  const assigned = store.students.filter(
    (s) =>
      store.enrollments.some((e) => e.studentId === s.studentId && e.teacherId === teacher.userId) ||
      store.classes.some((c) => c.teacherId === teacher.userId && store.enrollments.some((e) => e.classId === c.classId && e.studentId === s.studentId)),
  );
  const classes = store.classes.filter((c) => c.teacherId === teacher.userId);
  const duties = store.teacherDuties.filter((d) => d.teacherId === teacher.userId);
  return (
    <>
      <PageHeader
        kicker="Teacher workspace"
        title={displayName(teacher)}
        description={roleLabel(teacher.role)}
        actions={
          <Button type="button" variant="ghost" onClick={onBack}>
            Back to teachers
          </Button>
        }
      />
      <div className="desk-split">
        <Card title="Teacher information">
          <p>Email {emptyCell(teacher.email)}</p>
          <p>Phone {emptyCell(teacher.phone)}</p>
          <p>Position {emptyCell(teacher.position)}</p>
          <StatusBadge status={teacher.status} />
        </Card>
        <Card title="Assigned students">
          {assigned.length === 0 ? (
            <p className="hlc-muted">No records found.</p>
          ) : (
            assigned.map((s) => <p key={s.studentId}>{studentDisplay(s)}</p>)
          )}
        </Card>
        <Card title="Classes">
          {classes.length === 0 ? (
            <p className="hlc-muted">No records found.</p>
          ) : (
            classes.map((c) => <p key={c.classId}>{c.name}</p>)
          )}
        </Card>
        <Card title="Monthly calendar / duty">
          {duties.length === 0 ? (
            <p className="hlc-muted">No records found.</p>
          ) : (
            duties.slice(0, 12).map((d) => (
              <p key={d.dutyId}>
                {d.workDate} · {emptyCell(d.marker)}
              </p>
            ))
          )}
        </Card>
        <StaffTasksBlock store={store} teacher={teacher} onSave={onSave} />
      </div>
    </>
  );
}

export function ProfilePage({ user, onView }: { user: HirayaUser; onView: (id: ViewId) => void }) {
  return (
    <PageHeader
      kicker="Account"
      title={displayName(user)}
      description={`${roleLabel(user.role)} · ${emptyCell(user.email)}`}
      actions={
        <Button type="button" variant="ghost" onClick={() => onView('settings')}>
          Settings
        </Button>
      }
    />
  );
}
