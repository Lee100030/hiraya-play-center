import { FormEvent, useMemo, useState } from 'react';
import {
  Alert,
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
  Textarea,
  emptyCell,
} from '@hiraya/ui';
import { displayName, formatDate, newId, studentDisplay, todayIsoDate } from '@hiraya/utils';
import type {
  AttendanceRecord,
  EnrollmentApplication,
  HirayaDatabase,
  HirayaUser,
  NewsItem,
  Payment,
  Schedule,
  Student,
} from '@hiraya/types';
import {
  NEWS_CATEGORIES,
  PIPELINE_STAGES,
  normalizePipeline,
  parseApplicationExtra,
  programChoices,
  stringifyApplicationExtra,
  type ApplicationExtra,
} from '../lib/catalog';

function studentName(store: HirayaDatabase, studentId: string) {
  const row = store.students.find((s) => s.studentId === studentId);
  return row ? studentDisplay(row) : emptyCell(studentId);
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] || full, lastName: parts.slice(1).join(' ') };
}

export function EnrollmentPage({
  store,
  loading,
  onSave,
}: {
  store: HirayaDatabase;
  loading: boolean;
  onSave: (next: HirayaDatabase) => Promise<void>;
}) {
  const [open, setOpen] = useState<EnrollmentApplication | null>(null);
  const [extra, setExtra] = useState<ApplicationExtra | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <Loading />;

  async function persist(next: HirayaDatabase) {
    setBusy(true);
    setError('');
    try {
      await onSave(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    if (!open) return;
    const parsed = extra || parseApplicationExtra(open);
    const { firstName, lastName } = splitName(open.studentFullname);
    const studentId = newId('stu');
    const parent = store.users.find(
      (u) => u.role === 'parent' && u.email.toLowerCase() === open.parentEmail.toLowerCase(),
    );
    const parentId = parent?.userId || newId('usr');
    let users = store.users;
    if (!parent) {
      users = [
        ...users,
        {
          userId: parentId,
          username: open.parentEmail.split('@')[0] || parentId,
          firstName: splitName(open.parentFullname).firstName,
          middleName: '',
          lastName: splitName(open.parentFullname).lastName,
          fullname: open.parentFullname,
          email: open.parentEmail,
          role: 'parent',
          status: 'active',
          phone: open.parentPhone,
          address: parsed.parentAddress,
          position: parsed.relationship || 'Guardian',
          profileImagePath: '',
          createdAt: new Date().toISOString(),
          updatedAt: '',
          lastLoginAt: '',
          notifyAttendance: true,
          notifyPayments: true,
          notifySchedule: true,
          notifyProgress: true,
          dateFormat: 'MMM d, yyyy',
          timeFormat: 'HH:mm',
          theme: 'system',
          notes: '',
        } as HirayaUser,
      ];
    }
    const student: Student = {
      studentId,
      firstName,
      middleName: '',
      lastName,
      fullname: open.studentFullname,
      birthdate: open.studentBirthdate,
      age: open.studentAge,
      gender: open.studentGender,
      address: parsed.parentAddress,
      contactNumber: open.parentPhone,
      parentId,
      emergencyContact: open.parentFullname,
      emergencyPhone: open.parentPhone,
      qrCode: `HIRAYA-${studentId}`,
      gradeLevel: parsed.gradeLevel,
      program: open.preferredProgram,
      status: 'active',
      enrollmentDate: todayIsoDate(),
      notes: `Enrolled from ${open.applicationId}`,
      nickname: parsed.nickname,
    };
    await persist({
      ...store,
      users,
      students: [...store.students, student],
      parentStudents: [
        ...store.parentStudents,
        {
          parentStudentId: newId('ps'),
          parentId,
          studentId,
          relationship: parsed.relationship || 'guardian',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: '',
        },
      ],
      enrollmentApplications: store.enrollmentApplications.map((row) =>
        row.applicationId === open.applicationId
          ? { ...row, status: 'confirmed', studentNumber: studentId, extraJson: stringifyApplicationExtra(parsed) }
          : row,
      ),
    });
    setOpen(null);
  }

  return (
    <>
      <PageHeader
        kicker="Admissions"
        title="Enrollment inbox"
        description="Pipeline for incoming applications. Convert approved files into a student profile without retyping."
      />
      {error ? <Alert>{error}</Alert> : null}
      {store.enrollmentApplications.length === 0 ? (
        <EmptyState title="No records found." hint="Public applications land here." />
      ) : (
        <div className="hlc-gallery">
          {store.enrollmentApplications.map((row) => (
            <button
              key={row.applicationId}
              type="button"
              className="hlc-card hlc-person-card"
              onClick={() => {
                setOpen(row);
                setExtra(parseApplicationExtra(row));
              }}
            >
              <h3>{emptyCell(row.studentFullname)}</h3>
              <p>{emptyCell(row.parentFullname)}</p>
              <p>{emptyCell(row.preferredProgram)}</p>
              <StatusBadge status={normalizePipeline(row.status)} />
            </button>
          ))}
        </div>
      )}
      {open && extra ? (
        <Modal
          title={open.studentFullname || 'Application'}
          onClose={() => !busy && setOpen(null)}
          busy={busy}
          actions={
            <>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(null)}>
                Close
              </Button>
              <Button type="button" disabled={busy} onClick={() => void convert()}>
                Convert to student
              </Button>
            </>
          }
        >
          <div className="form-grid">
            <Field label="Pipeline">
              <Select
                value={normalizePipeline(open.status)}
                onChange={(e) =>
                  setOpen({ ...open, status: e.target.value })
                }
              >
                {PIPELINE_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Program">
              <Select
                value={open.preferredProgram}
                onChange={(e) => setOpen({ ...open, preferredProgram: e.target.value })}
              >
                {programChoices().map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <h3>Parent information</h3>
          <p>
            {emptyCell(open.parentFullname)} · {emptyCell(open.parentEmail)} · {emptyCell(open.parentPhone)}
          </p>
          <div className="form-grid">
            <Field label="Address">
              <Input value={extra.parentAddress} onChange={(e) => setExtra({ ...extra, parentAddress: e.target.value })} />
            </Field>
            <Field label="Relationship">
              <Input value={extra.relationship} onChange={(e) => setExtra({ ...extra, relationship: e.target.value })} />
            </Field>
            <Field label="Social media">
              <Input value={extra.socialMedia} onChange={(e) => setExtra({ ...extra, socialMedia: e.target.value })} />
            </Field>
          </div>
          <h3>Child information</h3>
          <p>
            {emptyCell(open.studentFullname)} · {emptyCell(open.studentBirthdate)} · age {open.studentAge || 'Not assigned'} ·{' '}
            {emptyCell(open.studentGender)}
          </p>
          <div className="form-grid">
            <Field label="Nickname">
              <Input value={extra.nickname} onChange={(e) => setExtra({ ...extra, nickname: e.target.value })} />
            </Field>
            <Field label="Current school">
              <Input value={extra.currentSchool} onChange={(e) => setExtra({ ...extra, currentSchool: e.target.value })} />
            </Field>
            <Field label="Grade / level">
              <Input value={extra.gradeLevel} onChange={(e) => setExtra({ ...extra, gradeLevel: e.target.value })} />
            </Field>
          </div>
          <h3>Requirements</h3>
          <Table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {extra.docs.map((doc, index) => (
                <tr key={doc.kind}>
                  <td>{doc.kind}</td>
                  <td>
                    <Select
                      value={doc.status}
                      onChange={(e) => {
                        const docs = extra.docs.map((item, i) =>
                          i === index ? { ...item, status: e.target.value as RequirementStatus } : item,
                        );
                        setExtra({ ...extra, docs });
                      }}
                    >
                      <option value="pending">pending</option>
                      <option value="approved">approved</option>
                      <option value="rejected">rejected</option>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void persist({
                  ...store,
                  enrollmentApplications: store.enrollmentApplications.map((row) =>
                    row.applicationId === open.applicationId
                      ? { ...open, extraJson: stringifyApplicationExtra(extra) }
                      : row,
                  ),
                })
              }
            >
              Save details
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

type RequirementStatus = 'pending' | 'approved' | 'rejected';

export function PaymentsPage({
  store,
  loading,
  onSave,
}: {
  store: HirayaDatabase;
  loading: boolean;
  onSave: (next: HirayaDatabase) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  const queue = store.payments.filter((p) => (p.proofPath || p.notes).trim() && ['pending', 'partial'].includes(p.paymentStatus));

  async function saveRow(row: Payment) {
    setBusy(true);
    try {
      const payments = store.payments.some((p) => p.paymentId === row.paymentId)
        ? store.payments.map((p) => (p.paymentId === row.paymentId ? row : p))
        : [...store.payments, row];
      await onSave({ ...store, payments });
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        kicker="Operations"
        title="Payment & billing"
        description="Live balances from the hub. Confirm proof to mark paid."
        actions={
          <Button type="button" onClick={() => setEditing({ paymentId: '', studentId: store.students[0]?.studentId || '', amount: 0, amountPaid: 0, paymentMethod: 'gcash', paymentStatus: 'pending', enrollmentId: '', referenceNumber: '', paymentDate: todayIsoDate(), dueAt: todayIsoDate(), paidAt: '', recordedBy: '', notes: '', history: [], proofPath: '', packageName: '12 Sessions', invoiceNumber: '' })}>
            + Payment
          </Button>
        }
      />
      {store.payments.length === 0 ? (
        <EmptyState title="No records found." hint="+ Payment to add a bill." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Program</th>
              <th>Package</th>
              <th>Amount due</th>
              <th>Due date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {store.payments.map((row) => {
              const student = store.students.find((s) => s.studentId === row.studentId);
              return (
                <tr key={row.paymentId} onDoubleClick={() => setEditing(row)}>
                  <td>{studentName(store, row.studentId)}</td>
                  <td>{emptyCell(student?.program)}</td>
                  <td>{emptyCell(row.packageName)}</td>
                  <td>₱{row.amount}</td>
                  <td>{formatDate(row.dueAt || row.paymentDate)}</td>
                  <td>
                    <StatusBadge status={row.paymentStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <h2>Verification queue</h2>
      {queue.length === 0 ? (
        <p className="hlc-muted">No proof waiting for review.</p>
      ) : (
        queue.map((row) => (
          <Card key={row.paymentId} title={studentName(store, row.studentId)}>
            <p>{emptyCell(row.notes || row.proofPath)}</p>
            <div className="hlc-toolbar">
              <Button type="button" onClick={() => void saveRow({ ...row, paymentStatus: 'paid', paidAt: todayIsoDate(), amountPaid: row.amount })}>
                Confirm
              </Button>
              <Button type="button" variant="danger" onClick={() => void saveRow({ ...row, paymentStatus: 'overdue' })}>
                Reject
              </Button>
            </div>
          </Card>
        ))
      )}
      {editing ? (
        <Modal
          title={editing.paymentId ? 'Payment' : 'New bill'}
          onClose={() => setEditing(null)}
          busy={busy}
          actions={
            <>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" form="pay-form" disabled={busy}>
                Save
              </Button>
            </>
          }
        >
          <form
            id="pay-form"
            className="form-grid"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget as HTMLFormElement);
              void saveRow({
                ...editing,
                paymentId: editing.paymentId || newId('pay'),
                studentId: String(form.get('studentId')),
                amount: Number(form.get('amount') || 0),
                packageName: String(form.get('packageName') || ''),
                dueAt: String(form.get('dueAt') || ''),
                paymentMethod: String(form.get('paymentMethod') || 'gcash'),
                invoiceNumber: String(form.get('invoiceNumber') || ''),
                proofPath: String(form.get('proofPath') || ''),
                notes: String(form.get('notes') || ''),
                paymentStatus: String(form.get('paymentStatus') || 'pending'),
                history: editing.history || [],
              });
            }}
          >
            <Field label="Student">
              <Select name="studentId" defaultValue={editing.studentId}>
                {store.students.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {studentDisplay(s)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Package">
              <Input name="packageName" defaultValue={editing.packageName || '12 Sessions'} />
            </Field>
            <Field label="Amount due">
              <Input name="amount" type="number" defaultValue={editing.amount} />
            </Field>
            <Field label="Due date">
              <Input name="dueAt" type="date" defaultValue={(editing.dueAt || '').slice(0, 10)} />
            </Field>
            <Field label="Method">
              <Select name="paymentMethod" defaultValue={editing.paymentMethod || 'gcash'}>
                <option value="gcash">GCash</option>
                <option value="bank">Bank transfer</option>
                <option value="cash">Cash</option>
              </Select>
            </Field>
            <Field label="Invoice no.">
              <Input name="invoiceNumber" defaultValue={editing.invoiceNumber} />
            </Field>
            <Field label="Proof / screenshot note">
              <Input name="proofPath" defaultValue={editing.proofPath} />
            </Field>
            <Field label="Status">
              <Select name="paymentStatus" defaultValue={editing.paymentStatus}>
                <option value="paid">paid</option>
                <option value="partial">partial</option>
                <option value="overdue">overdue</option>
                <option value="pending">pending</option>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea name="notes" defaultValue={editing.notes} />
            </Field>
          </form>
          {editing.history?.length ? (
            <Table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {editing.history.map((h) => (
                  <tr key={h.entryId}>
                    <td>{formatDate(h.changedAt)}</td>
                    <td>{emptyCell(h.summary)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}

export function AttendancePage({
  store,
  loading,
  onSave,
}: {
  store: HirayaDatabase;
  loading: boolean;
  onSave: (next: HirayaDatabase) => Promise<void>;
}) {
  const [date, setDate] = useState(todayIsoDate());
  const [classId, setClassId] = useState(store.classes[0]?.classId || '');
  const [busy, setBusy] = useState(false);
  const [studentId, setStudentId] = useState('');
  if (loading) return <Loading />;

  const enrolled = store.students.filter((s) => {
    if (!classId) return s.status === 'active';
    return store.enrollments.some((e) => e.classId === classId && e.studentId === s.studentId);
  });

  async function mark(student: Student, status: string) {
    setBusy(true);
    const existing = store.attendance.find(
      (a) => a.studentId === student.studentId && (a.attendanceDate || '').slice(0, 10) === date && a.kind !== 'employee',
    );
    const row: AttendanceRecord = existing
      ? { ...existing, status, classId, recordedBy: 'desktop' }
      : {
          attendanceId: newId('att'),
          kind: 'student',
          studentId: student.studentId,
          employeeId: '',
          classId,
          qrCode: student.qrCode,
          timeIn: new Date().toISOString(),
          timeOut: '',
          attendanceDate: date,
          status,
          notes: '',
          recordedBy: 'desktop',
        };
    const attendance = existing
      ? store.attendance.map((a) => (a.attendanceId === existing.attendanceId ? row : a))
      : [...store.attendance, row];
    try {
      await onSave({ ...store, attendance });
    } finally {
      setBusy(false);
    }
  }

  const monthRows = studentId
    ? store.attendance.filter((a) => a.studentId === studentId && (a.attendanceDate || '').startsWith(date.slice(0, 7)))
    : [];

  return (
    <>
      <PageHeader kicker="Operations" title="Attendance" description="Mark Present / Absent / Make-up per class and date." />
      <div className="form-grid toolbar">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Class">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">All active students</option>
            {store.classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {enrolled.length === 0 ? (
        <EmptyState title="No records found." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Mark</th>
            </tr>
          </thead>
          <tbody>
            {enrolled.map((s) => {
              const today = store.attendance.find(
                (a) => a.studentId === s.studentId && (a.attendanceDate || '').slice(0, 10) === date,
              );
              return (
                <tr key={s.studentId}>
                  <td>
                    <button type="button" className="hlc-btn hlc-btn-ghost" onClick={() => setStudentId(s.studentId)}>
                      {studentDisplay(s)}
                    </button>
                    {today ? <StatusBadge status={today.status} /> : null}
                  </td>
                  <td className="hlc-toolbar">
                    <Button type="button" disabled={busy} onClick={() => void mark(s, 'present')}>
                      Present
                    </Button>
                    <Button type="button" variant="danger" disabled={busy} onClick={() => void mark(s, 'absent')}>
                      Absent
                    </Button>
                    <Button type="button" variant="ghost" disabled={busy} onClick={() => void mark(s, 'makeup')}>
                      Make-up
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {studentId ? (
        <Card title={`Monthly · ${studentName(store, studentId)}`}>
          {monthRows.length === 0 ? (
            <p className="hlc-muted">No records found.</p>
          ) : (
            monthRows.map((row) => (
              <p key={row.attendanceId}>
                {formatDate(row.attendanceDate)} · <StatusBadge status={row.status} />
              </p>
            ))
          )}
        </Card>
      ) : null}
    </>
  );
}

export function SchedulesPage({
  store,
  loading,
  onSave,
}: {
  store: HirayaDatabase;
  loading: boolean;
  onSave: (next: HirayaDatabase) => Promise<void>;
}) {
  const [studentId, setStudentId] = useState(store.students[0]?.studentId || '');
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  const rows = store.schedules.filter((s) => !studentId || s.studentId === studentId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const row: Schedule = {
      scheduleId: newId('sch'),
      title: String(form.get('program') || 'Session'),
      kind: 'class',
      classId: '',
      studentId,
      teacherId: String(form.get('teacherId') || ''),
      scheduleType: 'session',
      startAt: `${form.get('day')}T${form.get('start')}:00`,
      endAt: `${form.get('day')}T${form.get('end')}:00`,
      room: '',
      notes: String(form.get('program') || ''),
      status: 'active',
    };
    setBusy(true);
    try {
      await onSave({ ...store, schedules: [...store.schedules, row] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader kicker="Operations" title="Schedule builder" description="Assign day, time, and program per student." />
      <Field label="Student">
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          {store.students.map((s) => (
            <option key={s.studentId} value={s.studentId}>
              {studentDisplay(s)}
            </option>
          ))}
        </Select>
      </Field>
      <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Day">
          <Input name="day" type="date" required />
        </Field>
        <Field label="Start">
          <Input name="start" type="time" required />
        </Field>
        <Field label="End">
          <Input name="end" type="time" required />
        </Field>
        <Field label="Program">
          <Select name="program">
            {programChoices().map((p) => (
              <option key={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Teacher">
          <Select name="teacherId">
            <option value="">Not assigned</option>
            {store.users
              .filter((u) => u.role === 'teacher')
              .map((u) => (
                <option key={u.userId} value={u.userId}>
                  {displayName(u)}
                </option>
              ))}
          </Select>
        </Field>
        <Button type="submit" disabled={busy}>
          Add slot
        </Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No records found." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>When</th>
              <th>Program</th>
              <th>Teacher</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.scheduleId}>
                <td>
                  {formatDate(row.startAt)} {emptyCell(row.startAt.slice(11, 16))}–{emptyCell(row.endAt.slice(11, 16))}
                </td>
                <td>{emptyCell(row.notes || row.title)}</td>
                <td>{emptyCell(displayName(store.users.find((u) => u.userId === row.teacherId)))}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

export function AnnouncementsPage({
  store,
  loading,
  user,
  onSave,
}: {
  store: HirayaDatabase;
  loading: boolean;
  user: HirayaUser;
  onSave: (next: HirayaDatabase) => Promise<void>;
}) {
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;

  async function save(row: NewsItem) {
    setBusy(true);
    try {
      const news = store.news.some((n) => n.newsId === row.newsId)
        ? store.news.map((n) => (n.newsId === row.newsId ? row : n))
        : [...store.news, row];
      await onSave({ ...store, news });
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        kicker="Communications"
        title="Announcement center"
        actions={
          <Button type="button" onClick={() => setEditing({ newsId: '', title: '', body: '', publishedAt: todayIsoDate(), isPublished: true, status: 'published', createdBy: user.userId, category: 'classes' })}>
            + Announcement
          </Button>
        }
      />
      {store.news.length === 0 ? (
        <EmptyState title="No records found." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Title</th>
              <th>Category</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {store.news.map((row) => (
              <tr key={row.newsId}>
                <td>{formatDate(row.publishedAt)}</td>
                <td>
                  <button type="button" className="hlc-btn hlc-btn-ghost" onClick={() => setEditing(row)}>
                    {row.title}
                  </button>
                </td>
                <td>{emptyCell(NEWS_CATEGORIES.find((c) => c.id === row.category)?.label || row.category)}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {editing ? (
        <Modal
          title={editing.newsId ? 'Edit announcement' : 'New announcement'}
          onClose={() => setEditing(null)}
          busy={busy}
          actions={
            <>
              {editing.newsId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    void save({
                      ...editing,
                      isPublished: false,
                      status: 'unpublished',
                    })
                  }
                >
                  Unpublish
                </Button>
              ) : null}
              <Button type="submit" form="news-form">
                Save
              </Button>
            </>
          }
        >
          <form
            id="news-form"
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void save({
                ...editing,
                newsId: editing.newsId || newId('news'),
                title: String(form.get('title')),
                body: String(form.get('body')),
                publishedAt: String(form.get('publishedAt')),
                category: String(form.get('category')),
                isPublished: true,
                status: 'published',
                createdBy: user.userId,
              });
            }}
          >
            <Field label="Date">
              <Input name="publishedAt" type="date" defaultValue={(editing.publishedAt || '').slice(0, 10)} />
            </Field>
            <Field label="Category">
              <Select name="category" defaultValue={editing.category || 'classes'}>
                {NEWS_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title">
              <Input name="title" defaultValue={editing.title} required />
            </Field>
            <Field label="Details">
              <Textarea name="body" defaultValue={editing.body} required />
            </Field>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

type FeedbackPayload = {
  rating: number;
  enjoy: string;
  improve: string;
  recommend: string;
  promo: boolean;
  parentName: string;
};

export function FeedbackPage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  if (loading) return <Loading />;
  const rows = store.alerts.filter((a) => a.kind === 'parent_feedback');
  const parsed = rows.map((row) => {
    try {
      return { id: row.alertId, ...(JSON.parse(row.message) as FeedbackPayload) };
    } catch {
      return { id: row.alertId, rating: 0, enjoy: row.message, improve: '', recommend: '', promo: false, parentName: row.title };
    }
  });
  const avg = parsed.length ? parsed.reduce((n, r) => n + Number(r.rating || 0), 0) / parsed.length : 0;
  return (
    <>
      <PageHeader
        kicker="Communications"
        title="Parent feedback"
        description={parsed.length ? `Average rating ${avg.toFixed(1)} / 5 from ${parsed.length} responses.` : 'Live ratings from parent submissions.'}
      />
      {parsed.length === 0 ? (
        <EmptyState title="No records found." hint="Parent portal submissions will appear here." />
      ) : (
        parsed.map((row) => (
          <Card key={row.id} title={`${emptyCell(row.parentName)} · ${row.rating || '—'}★`}>
            <p>Enjoyed: {emptyCell(row.enjoy)}</p>
            <p>Improve: {emptyCell(row.improve)}</p>
            <p>Recommend: {emptyCell(row.recommend)}</p>
            <p>Promo consent: {row.promo ? 'Yes' : 'No'}</p>
          </Card>
        ))
      )}
    </>
  );
}

export function GroupChatPage({
  store,
  loading,
  user,
  onSave,
}: {
  store: HirayaDatabase;
  loading: boolean;
  user: HirayaUser;
  onSave: (next: HirayaDatabase) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const messages = useMemo(
    () => store.alerts.filter((a) => a.kind === 'parent_chat').sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [store.alerts],
  );
  if (loading) return <Loading />;

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSave({
        ...store,
        alerts: [
          ...store.alerts,
          {
            alertId: newId('chat'),
            kind: 'parent_chat',
            title: displayName(user),
            message: text.trim(),
            recipientId: 'parents',
            href: '',
            status: 'active',
            createdAt: new Date().toISOString(),
            read: false,
          },
        ],
      });
      setText('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader kicker="Communications" title="Parents group chat" description="Staff messages to the parent group. Same hub as later parent surfaces." />
      {messages.length === 0 ? <EmptyState title="No records found." hint="Send the first message." /> : null}
      <ul className="quiet-list">
        {messages.map((row) => (
          <li key={row.alertId} className="hlc-card stack-item">
            <strong>{emptyCell(row.title)}</strong>
            <span>{formatDate(row.createdAt)}</span>
            <p>{row.message}</p>
          </li>
        ))}
      </ul>
      <div className="toolbar">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message parents" />
        <Button type="button" disabled={busy} onClick={() => void send()}>
          Send
        </Button>
      </div>
    </>
  );
}

export function ProgramsPage({ store, loading }: { store: HirayaDatabase; loading: boolean }) {
  if (loading) return <Loading />;
  const rows = programChoices();
  return (
    <>
      <PageHeader kicker="Learning" title="Programs" description="Playgroup, Pre-school, ABA Therapy, Tutorial Session." />
      <div className="hlc-gallery">
        {rows.map((p) => (
          <Card key={p.id} title={p.name}>
            <StatusBadge status={store.programs.find((x) => x.name === p.name)?.status || 'offered'} />
          </Card>
        ))}
      </div>
    </>
  );
}
