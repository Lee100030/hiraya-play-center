import { FormEvent, useMemo, useState } from 'react';
import {
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
import {
  CALENDAR_CATEGORIES,
  FULL_PIPELINE,
  MAKEUP_REASONS,
  STANDARD_FORMS,
  displayName,
  formatDate,
  newId,
  studentDisplay,
  todayIsoDate,
} from '@hiraya/utils';
import type {
  CalendarEntry,
  CertificateRequest,
  FieldTrip,
  HirayaDatabase,
  HirayaUser,
  MakeupRequest,
  StaffTask,
  SystemAlert,
} from '@hiraya/types';
import { programChoices } from '../lib/catalog';

function studentName(store: HirayaDatabase, id: string) {
  const row = store.students.find((s) => s.studentId === id);
  return row ? studentDisplay(row) : emptyCell(id);
}

function notify(store: HirayaDatabase, title: string, message: string, kind = 'system'): SystemAlert[] {
  return [
    ...store.alerts,
    {
      alertId: newId('ntf'),
      kind,
      title,
      message,
      recipientId: 'admins',
      href: '',
      status: 'active',
      createdAt: new Date().toISOString(),
      read: false,
    },
  ];
}

function ensureForms(store: HirayaDatabase): HirayaDatabase {
  if (store.centerForms.length) return store;
  return {
    ...store,
    centerForms: STANDARD_FORMS.map((title) => ({
      formId: newId('frm'),
      title,
      fileNote: '',
      status: 'published',
    })),
  };
}

export function MakeupPage({
  store,
  loading,
  onSave,
}: {
  store: HirayaDatabase;
  loading: boolean;
  onSave: (next: HirayaDatabase) => Promise<void>;
}) {
  const [editing, setEditing] = useState<MakeupRequest | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;

  async function save(row: MakeupRequest, extra?: Partial<HirayaDatabase>) {
    setBusy(true);
    try {
      const makeupRequests = store.makeupRequests.some((r) => r.requestId === row.requestId)
        ? store.makeupRequests.map((r) => (r.requestId === row.requestId ? row : r))
        : [...store.makeupRequests, row];
      let next: HirayaDatabase = { ...store, makeupRequests, ...extra };
      if (row.status === 'approved' || row.status === 'rejected') {
        next = {
          ...next,
          alerts: notify(
            next,
            `Make-up ${row.status}`,
            `${studentName(store, row.studentId)} · ${row.scheduledDate || row.preferred1}`,
            'schedule',
          ),
        };
      }
      await onSave(next);
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        kicker="Operations"
        title="Make-up session requests"
        actions={
          <Button
            type="button"
            onClick={() =>
              setEditing({
                requestId: '',
                studentId: store.students[0]?.studentId || '',
                program: programChoices()[0].name,
                missedDate: todayIsoDate(),
                reason: 'Weather',
                preferred1: '',
                preferred2: '',
                preferred3: '',
                scheduledDate: '',
                status: 'pending',
                notes: '',
              })
            }
          >
            + Request
          </Button>
        }
      />
      {store.makeupRequests.length === 0 ? (
        <EmptyState title="No records found." hint="Parent-submitted make-up dates land here for approve/reject/edit." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Child</th>
              <th>Program</th>
              <th>Missed</th>
              <th>Reason</th>
              <th>Preferred dates</th>
              <th>Scheduled</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {store.makeupRequests.map((row) => (
              <tr key={row.requestId}>
                <td>
                  <button type="button" className="hlc-btn hlc-btn-ghost" onClick={() => setEditing(row)}>
                    {studentName(store, row.studentId)}
                  </button>
                </td>
                <td>{emptyCell(row.program)}</td>
                <td>{formatDate(row.missedDate)}</td>
                <td>{emptyCell(row.reason)}</td>
                <td>{[row.preferred1, row.preferred2, row.preferred3].filter(Boolean).join(' · ') || 'Not assigned'}</td>
                <td>{formatDate(row.scheduledDate)}</td>
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
          title="Make-up request"
          onClose={() => setEditing(null)}
          busy={busy}
          actions={
            <>
              <Button type="button" variant="danger" onClick={() => void save({ ...editing, requestId: editing.requestId || newId('mk'), status: 'rejected' })}>
                Reject
              </Button>
              <Button type="submit" form="mk-form">
                Approve
              </Button>
            </>
          }
        >
          <form
            id="mk-form"
            className="form-grid"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget as HTMLFormElement);
              void save({
                ...editing,
                requestId: editing.requestId || newId('mk'),
                studentId: String(form.get('studentId')),
                program: String(form.get('program')),
                missedDate: String(form.get('missedDate')),
                reason: String(form.get('reason')),
                preferred1: String(form.get('preferred1')),
                preferred2: String(form.get('preferred2')),
                preferred3: String(form.get('preferred3')),
                scheduledDate: String(form.get('scheduledDate')),
                notes: String(form.get('notes')),
                status: 'approved',
              });
            }}
          >
            <Field label="Child">
              <Select name="studentId" defaultValue={editing.studentId}>
                {store.students.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {studentDisplay(s)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Program">
              <Select name="program" defaultValue={editing.program}>
                {programChoices().map((p) => (
                  <option key={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Missed date">
              <Input name="missedDate" type="date" defaultValue={editing.missedDate} />
            </Field>
            <Field label="Reason">
              <Select name="reason" defaultValue={editing.reason}>
                {MAKEUP_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
            <Field label="Preferred 1">
              <Input name="preferred1" type="date" defaultValue={editing.preferred1} />
            </Field>
            <Field label="Preferred 2">
              <Input name="preferred2" type="date" defaultValue={editing.preferred2} />
            </Field>
            <Field label="Preferred 3">
              <Input name="preferred3" type="date" defaultValue={editing.preferred3} />
            </Field>
            <Field label="Admin scheduled date">
              <Input name="scheduledDate" type="date" defaultValue={editing.scheduledDate || editing.preferred1} required />
            </Field>
            <Field label="Notes">
              <Textarea name="notes" defaultValue={editing.notes} />
            </Field>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

export function CertificatesPage({
  store,
  loading,
  onSave,
}: {
  store: HirayaDatabase;
  loading: boolean;
  onSave: (next: HirayaDatabase) => Promise<void>;
}) {
  const [editing, setEditing] = useState<CertificateRequest | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;

  async function save(row: CertificateRequest) {
    setBusy(true);
    try {
      const certificateRequests = store.certificateRequests.some((r) => r.requestId === row.requestId)
        ? store.certificateRequests.map((r) => (r.requestId === row.requestId ? row : r))
        : [...store.certificateRequests, row];
      await onSave({
        ...store,
        certificateRequests,
        alerts: notify(store, `Certificate ${row.status}`, `${studentName(store, row.studentId)} · ${row.certificateType}`, 'announcement'),
      });
      setEditing(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        kicker="Records"
        title="Certificate requests"
        actions={
          <Button
            type="button"
            onClick={() =>
              setEditing({
                requestId: '',
                studentId: store.students[0]?.studentId || '',
                program: '',
                startDate: '',
                completionDate: '',
                certificateType: 'Completion',
                status: 'received',
                fileNote: '',
              })
            }
          >
            + Certificate
          </Button>
        }
      />
      {store.certificateRequests.length === 0 ? (
        <EmptyState title="No records found." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Child</th>
              <th>Program</th>
              <th>Type</th>
              <th>Dates</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {store.certificateRequests.map((row) => (
              <tr key={row.requestId}>
                <td>
                  <button type="button" className="hlc-btn hlc-btn-ghost" onClick={() => setEditing(row)}>
                    {studentName(store, row.studentId)}
                  </button>
                </td>
                <td>{emptyCell(row.program)}</td>
                <td>{emptyCell(row.certificateType)}</td>
                <td>
                  {formatDate(row.startDate)} – {formatDate(row.completionDate)}
                </td>
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
          title="Certificate"
          onClose={() => setEditing(null)}
          busy={busy}
          actions={
            <>
              <Button type="button" variant="ghost" onClick={() => void save({ ...editing, requestId: editing.requestId || newId('crt'), status: 'processing' })}>
                Processing
              </Button>
              <Button type="submit" form="crt-form">
                Mark ready
              </Button>
            </>
          }
        >
          <form
            id="crt-form"
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void save({
                ...editing,
                requestId: editing.requestId || newId('crt'),
                studentId: String(form.get('studentId')),
                program: String(form.get('program')),
                startDate: String(form.get('startDate')),
                completionDate: String(form.get('completionDate')),
                certificateType: String(form.get('certificateType')),
                fileNote: String(form.get('fileNote')),
                status: 'ready',
              });
            }}
          >
            <Field label="Child">
              <Select name="studentId" defaultValue={editing.studentId}>
                {store.students.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {studentDisplay(s)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Program">
              <Input name="program" defaultValue={editing.program} />
            </Field>
            <Field label="Type">
              <Select name="certificateType" defaultValue={editing.certificateType}>
                <option>Completion</option>
                <option>Participation</option>
                <option>Other</option>
              </Select>
            </Field>
            <Field label="Start">
              <Input name="startDate" type="date" defaultValue={editing.startDate} />
            </Field>
            <Field label="Completion">
              <Input name="completionDate" type="date" defaultValue={editing.completionDate} />
            </Field>
            <Field label="File / acknowledgment note">
              <Input name="fileNote" defaultValue={editing.fileNote} />
            </Field>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

export function FieldTripsPage({
  store,
  loading,
  onSave,
}: {
  store: HirayaDatabase;
  loading: boolean;
  onSave: (next: HirayaDatabase) => Promise<void>;
}) {
  const [trip, setTrip] = useState<FieldTrip | null>(null);
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;

  async function save(row: FieldTrip) {
    setBusy(true);
    try {
      const fieldTrips = store.fieldTrips.some((t) => t.tripId === row.tripId)
        ? store.fieldTrips.map((t) => (t.tripId === row.tripId ? row : t))
        : [...store.fieldTrips, row];
      await onSave({ ...store, fieldTrips });
      setTrip(row);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        kicker="Operations"
        title="Field trip RSVP"
        actions={
          <Button
            type="button"
            onClick={() =>
              setTrip({ tripId: newId('trip'), title: '', tripDate: todayIsoDate(), place: '', status: 'open', rsvps: [] })
            }
          >
            + Trip
          </Button>
        }
      />
      {store.fieldTrips.length === 0 ? <EmptyState title="No records found." /> : null}
      {store.fieldTrips.map((row) => {
        const yes = row.rsvps.filter((r) => r.response === 'yes').length;
        const no = row.rsvps.filter((r) => r.response === 'no').length;
        return (
          <Card key={row.tripId} title={row.title || 'Untitled trip'}>
            <p>
              {formatDate(row.tripDate)} · {emptyCell(row.place)}
            </p>
            <p>
              Headcount (live): <strong>{yes}</strong> going · {no} not going · {row.rsvps.length} replies
            </p>
            <Button type="button" variant="ghost" onClick={() => setTrip(row)}>
              Manage RSVP
            </Button>
          </Card>
        );
      })}
      {trip ? (
        <Modal
          title={trip.title || 'Field trip'}
          onClose={() => setTrip(null)}
          busy={busy}
          actions={
            <Button type="submit" form="trip-form">
              Save
            </Button>
          }
        >
          <form
            id="trip-form"
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void save({
                ...trip,
                title: String(form.get('title')),
                tripDate: String(form.get('tripDate')),
                place: String(form.get('place')),
              });
            }}
          >
            <Field label="Title">
              <Input name="title" defaultValue={trip.title} required />
            </Field>
            <Field label="Date">
              <Input name="tripDate" type="date" defaultValue={trip.tripDate} />
            </Field>
            <Field label="Place">
              <Input name="place" defaultValue={trip.place} />
            </Field>
          </form>
          <Table>
            <thead>
              <tr>
                <th>Family</th>
                <th>Going</th>
                <th>Contact</th>
                <th>Guidelines</th>
              </tr>
            </thead>
            <tbody>
              {store.users
                .filter((u) => u.role === 'parent')
                .map((parent) => {
                  const rsvp = trip.rsvps.find((r) => r.parentId === parent.userId);
                  return (
                    <tr key={parent.userId}>
                      <td>{displayName(parent)}</td>
                      <td>
                        <Select
                          value={rsvp?.response || ''}
                          onChange={(e) => {
                            const response = e.target.value;
                            const rest = trip.rsvps.filter((r) => r.parentId !== parent.userId);
                            setTrip({
                              ...trip,
                              rsvps: response
                                ? [
                                    ...rest,
                                    {
                                      rsvpId: rsvp?.rsvpId || newId('rsvp'),
                                      parentId: parent.userId,
                                      studentId: '',
                                      response,
                                      contact: rsvp?.contact || parent.phone || '',
                                      agreedGuidelines: rsvp?.agreedGuidelines || false,
                                    },
                                  ]
                                : rest,
                            });
                          }}
                        >
                          <option value="">—</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </Select>
                      </td>
                      <td>{emptyCell(rsvp?.contact || parent.phone)}</td>
                      <td>{rsvp?.agreedGuidelines ? 'Yes' : 'No'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </Table>
          <p>
            Auto headcount:{' '}
            <strong>{trip.rsvps.filter((r) => r.response === 'yes').length}</strong>
          </p>
        </Modal>
      ) : null}
    </>
  );
}

export function FormsPage({
  store,
  loading,
  onSave,
}: {
  store: HirayaDatabase;
  loading: boolean;
  onSave: (next: HirayaDatabase) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [studentId, setStudentId] = useState(store.students[0]?.studentId || '');
  if (loading) return <Loading />;
  const ready = ensureForms(store);

  async function seed() {
    setBusy(true);
    try {
      await onSave(ready);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(formId: string, signed: boolean) {
    setBusy(true);
    try {
      const existing = ready.formSubmissions.find((s) => s.formId === formId && s.studentId === studentId);
      const formSubmissions = existing
        ? ready.formSubmissions.map((s) =>
            s.submissionId === existing.submissionId
              ? { ...s, status: signed ? 'signed' : 'outstanding', submittedAt: signed ? todayIsoDate() : '' }
              : s,
          )
        : [
            ...ready.formSubmissions,
            {
              submissionId: newId('fsub'),
              formId,
              studentId,
              status: signed ? 'signed' : 'outstanding',
              submittedAt: signed ? todayIsoDate() : '',
            },
          ];
      await onSave({ ...ready, formSubmissions });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        kicker="Records"
        title="Forms & documents"
        actions={
          <Button type="button" disabled={busy} onClick={() => void seed()}>
            Publish standard library
          </Button>
        }
      />
      {ready.centerForms.length === 0 ? (
        <EmptyState title="No records found." hint="Publish the standard library so parents can receive the same files." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Form</th>
              <th>File</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ready.centerForms.map((row) => (
              <tr key={row.formId}>
                <td>{row.title}</td>
                <td>{emptyCell(row.fileNote)}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <h2>Submission tracking</h2>
      <Field label="Student">
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          {store.students.map((s) => (
            <option key={s.studentId} value={s.studentId}>
              {studentDisplay(s)}
            </option>
          ))}
        </Select>
      </Field>
      {ready.centerForms.map((form) => {
        const sub = ready.formSubmissions.find((s) => s.formId === form.formId && s.studentId === studentId);
        const signed = sub?.status === 'signed';
        return (
          <p key={form.formId}>
            {form.title} <StatusBadge status={signed ? 'signed' : 'outstanding'} />{' '}
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void toggle(form.formId, !signed)}>
              {signed ? 'Mark outstanding' : 'Mark signed'}
            </Button>
          </p>
        );
      })}
    </>
  );
}

export function CalendarAdminPage({
  store,
  loading,
  onSave,
}: {
  store: HirayaDatabase;
  loading: boolean;
  onSave: (next: HirayaDatabase) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  const rows = [...store.calendarEntries].sort((a, b) => a.startAt.localeCompare(b.startAt));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const row: CalendarEntry = {
      entryId: newId('cal'),
      title: String(form.get('title')),
      category: String(form.get('category')),
      startAt: String(form.get('startAt')),
      endAt: String(form.get('endAt')),
      notes: String(form.get('notes')),
    };
    setBusy(true);
    try {
      await onSave({
        ...store,
        calendarEntries: [...store.calendarEntries, row],
        alerts: notify(store, 'Calendar updated', `${row.title} · ${row.startAt}`, 'schedule'),
      });
      event.currentTarget.reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader kicker="Operations" title="Center calendar" description="Class days, activities, trips, events, suspensions, make-ups, dues, and meetings." />
      <form className="form-grid" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Title">
          <Input name="title" required />
        </Field>
        <Field label="Category">
          <Select name="category">
            {CALENDAR_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start">
          <Input name="startAt" type="datetime-local" required />
        </Field>
        <Field label="End">
          <Input name="endAt" type="datetime-local" />
        </Field>
        <Field label="Notes">
          <Input name="notes" />
        </Field>
        <Button type="submit" disabled={busy}>
          Add entry
        </Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No records found." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>When</th>
              <th>Category</th>
              <th>Title</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.entryId}>
                <td>{formatDate(row.startAt)}</td>
                <td>{CALENDAR_CATEGORIES.find((c) => c.id === row.category)?.label || row.category}</td>
                <td>{row.title}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {store.centerHolidays.length || store.teacherDuties.length ? (
        <Card title="Holidays and duty markers">
          {store.centerHolidays.map((row) => (
            <p key={row.holidayId}>
              {row.date} · Holiday · {emptyCell(row.title)}
            </p>
          ))}
          {store.teacherDuties.slice(0, 12).map((row) => (
            <p key={row.dutyId}>
              {row.workDate} · Duty · {emptyCell(displayName(store.users.find((u) => u.userId === row.teacherId)))}
            </p>
          ))}
        </Card>
      ) : null}
    </>
  );
}

export function PipelinePage({ store, loading, onView }: { store: HirayaDatabase; loading: boolean; onView?: (id: 'enrollment' | 'students') => void }) {
  const families = useMemo(() => {
    const fromApps = store.enrollmentApplications.map((app) => ({
      id: app.applicationId,
      name: app.studentFullname,
      parent: app.parentFullname,
      stage: app.status === 'confirmed' ? 'confirmation' : app.status === 'approved' ? 'enrollment' : app.status === 'pending_review' ? 'application' : app.status || 'inquiry',
    }));
    const fromStudents = store.students.map((s) => {
      const parent = store.users.find((u) => u.userId === s.parentId);
      const hasSched = store.schedules.some((x) => x.studentId === s.studentId);
      const hasAtt = store.attendance.some((x) => x.studentId === s.studentId);
      const makeup = store.makeupRequests.some((x) => x.studentId === s.studentId && x.status === 'pending');
      const prog = store.reports.some((x) => x.studentId === s.studentId);
      const cert = store.certificateRequests.find((x) => x.studentId === s.studentId);
      const pay = store.payments.find((x) => x.studentId === s.studentId && ['pending', 'partial', 'overdue'].includes(x.paymentStatus));
      let stage = 'confirmation';
      if (pay) stage = 'payment';
      else if (!hasSched) stage = 'schedule';
      else if (!hasAtt) stage = 'attendance';
      else if (makeup) stage = 'makeup';
      else if (!prog) stage = 'progress';
      else if (cert && cert.status !== 'ready' && cert.status !== 'downloaded') stage = 'certificate';
      else if (s.status !== 'active') stage = 'enrollment';
      return { id: s.studentId, name: studentDisplay(s), parent: parent ? displayName(parent) : 'Not assigned', stage };
    });
    return [...fromApps.filter((a) => a.stage !== 'confirmation'), ...fromStudents];
  }, [store]);

  if (loading) return <Loading />;
  return (
    <>
      <PageHeader kicker="Admissions" title="Family pipeline" description="Inquiry through certificate — live from hub records, not a second spreadsheet." />
      <div className="desk-split" style={{ alignItems: 'start' }}>
        {FULL_PIPELINE.map((stage) => (
          <Card key={stage} title={stage}>
            {families.filter((f) => f.stage === stage).length === 0 ? (
              <p className="hlc-muted">No records found.</p>
            ) : (
              families
                .filter((f) => f.stage === stage)
                .map((f) => (
                  <button key={f.id} type="button" className="hlc-person-card" onClick={() => onView?.(f.id.startsWith('stu') ? 'students' : 'enrollment')}>
                    <strong>{f.name}</strong>
                    <span>{f.parent}</span>
                  </button>
                ))
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

export function StaffTasksBlock({
  store,
  teacher,
  onSave,
}: {
  store: HirayaDatabase;
  teacher: HirayaUser;
  onSave?: (next: HirayaDatabase) => Promise<void>;
}) {
  const tasks = store.staffTasks.filter((t) => t.teacherId === teacher.userId);
  const sessions = store.reports.filter((r) => r.teacherId === teacher.userId);
  const [busy, setBusy] = useState(false);

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onSave) return;
    const form = new FormData(event.currentTarget);
    const row: StaffTask = {
      taskId: newId('tsk'),
      teacherId: teacher.userId,
      title: String(form.get('title')),
      dueDate: String(form.get('dueDate')),
      status: 'open',
      notes: String(form.get('notes')),
    };
    setBusy(true);
    try {
      await onSave({ ...store, staffTasks: [...store.staffTasks, row] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card title="Assigned tasks">
        {onSave ? (
          <form className="form-grid" onSubmit={(e) => void addTask(e)}>
            <Field label="Task">
              <Input name="title" required />
            </Field>
            <Field label="Due">
              <Input name="dueDate" type="date" />
            </Field>
            <Field label="Notes">
              <Input name="notes" />
            </Field>
            <Button type="submit" disabled={busy}>
              Assign
            </Button>
          </form>
        ) : null}
        {tasks.length === 0 ? <p className="hlc-muted">No records found.</p> : tasks.map((t) => (
          <p key={t.taskId}>
            {t.title} · {formatDate(t.dueDate)} · <StatusBadge status={t.status} />
          </p>
        ))}
      </Card>
      <Card title="Session records (ABA / tutorial)">
        {sessions.length === 0 ? (
          <p className="hlc-muted">No records found. Teacher-logged progress appears here for admin review.</p>
        ) : (
          sessions.slice(0, 12).map((r) => (
            <p key={r.reportId}>
              {studentName(store, r.studentId)} · {formatDate(r.createdAt)} · {emptyCell(r.area)} ·{' '}
              <StatusBadge status={r.status} />
            </p>
          ))
        )}
      </Card>
    </>
  );
}
