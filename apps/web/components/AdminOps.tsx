'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Button, Card, EmptyState, Field, Input, Loading, Select, StatusBadge, Table, Textarea } from '@hiraya/ui';
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
import type { CalendarEntry, CertificateRequest, FieldTrip, MakeupRequest } from '@hiraya/types';
import { useStore } from './StoreProvider';

function childName(store: ReturnType<typeof useStore>['store'], id: string) {
  const row = store.students.find((s) => s.studentId === id);
  return row ? studentDisplay(row) : id;
}

export function MakeupOpsPage() {
  const { store, loading, save } = useStore();
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const row: MakeupRequest = {
      requestId: newId('mk'),
      studentId: String(form.get('studentId')),
      program: String(form.get('program')),
      missedDate: String(form.get('missedDate')),
      reason: String(form.get('reason')),
      preferred1: String(form.get('preferred1')),
      preferred2: String(form.get('preferred2')),
      preferred3: String(form.get('preferred3')),
      scheduledDate: String(form.get('scheduledDate')),
      status: 'pending',
      notes: String(form.get('notes')),
    };
    setBusy(true);
    try {
      await save({ ...store, makeupRequests: [...(store.makeupRequests || []), row] });
      event.currentTarget.reset();
    } finally {
      setBusy(false);
    }
  }

  async function decide(row: MakeupRequest, status: string, scheduledDate?: string) {
    setBusy(true);
    try {
      await save({
        ...store,
        makeupRequests: store.makeupRequests.map((r) =>
          r.requestId === row.requestId ? { ...r, status, scheduledDate: scheduledDate ?? r.scheduledDate } : r,
        ),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Make-up session requests</h1>
      <form className="hlc-card form-grid" onSubmit={(e) => void add(e)}>
        <Field label="Child">
          <Select name="studentId">
            {store.students.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {studentDisplay(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Program">
          <Input name="program" />
        </Field>
        <Field label="Missed date">
          <Input name="missedDate" type="date" defaultValue={todayIsoDate()} />
        </Field>
        <Field label="Reason">
          <Select name="reason">
            {MAKEUP_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Preferred 1">
          <Input name="preferred1" type="date" />
        </Field>
        <Field label="Preferred 2">
          <Input name="preferred2" type="date" />
        </Field>
        <Field label="Preferred 3">
          <Input name="preferred3" type="date" />
        </Field>
        <Field label="Admin scheduled date">
          <Input name="scheduledDate" type="date" />
        </Field>
        <Field label="Notes">
          <Textarea name="notes" />
        </Field>
        <Button type="submit" disabled={busy}>
          Add request
        </Button>
      </form>
      {(store.makeupRequests || []).length === 0 ? (
        <EmptyState title="No records found." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Child</th>
              <th>Missed</th>
              <th>Scheduled</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {store.makeupRequests.map((row) => (
              <tr key={row.requestId}>
                <td>{childName(store, row.studentId)}</td>
                <td>{formatDate(row.missedDate)}</td>
                <td>{formatDate(row.scheduledDate)}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => void decide(row, 'approved', row.scheduledDate || row.preferred1)}>
                    Approve
                  </Button>
                  <Button type="button" variant="danger" disabled={busy} onClick={() => void decide(row, 'rejected')}>
                    Reject
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

export function CertificatesOpsPage() {
  const { store, loading, save } = useStore();
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const row: CertificateRequest = {
      requestId: newId('crt'),
      studentId: String(form.get('studentId')),
      program: String(form.get('program')),
      startDate: String(form.get('startDate')),
      completionDate: String(form.get('completionDate')),
      certificateType: String(form.get('certificateType')),
      status: 'received',
      fileNote: String(form.get('fileNote')),
    };
    setBusy(true);
    try {
      await save({ ...store, certificateRequests: [...(store.certificateRequests || []), row] });
      event.currentTarget.reset();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(true);
    try {
      await save({
        ...store,
        certificateRequests: store.certificateRequests.map((r) => (r.requestId === id ? { ...r, status } : r)),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Certificate requests</h1>
      <form className="hlc-card form-grid" onSubmit={(e) => void add(e)}>
        <Field label="Child">
          <Select name="studentId">
            {store.students.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {studentDisplay(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Program">
          <Input name="program" />
        </Field>
        <Field label="Type">
          <Select name="certificateType">
            <option>Completion</option>
            <option>Participation</option>
            <option>Other</option>
          </Select>
        </Field>
        <Field label="Start">
          <Input name="startDate" type="date" />
        </Field>
        <Field label="Completion">
          <Input name="completionDate" type="date" />
        </Field>
        <Field label="File note">
          <Input name="fileNote" />
        </Field>
        <Button type="submit" disabled={busy}>
          Receive request
        </Button>
      </form>
      {(store.certificateRequests || []).length === 0 ? (
        <EmptyState title="No records found." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Child</th>
              <th>Type</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {store.certificateRequests.map((row) => (
              <tr key={row.requestId}>
                <td>{childName(store, row.studentId)}</td>
                <td>{row.certificateType}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => void setStatus(row.requestId, 'processing')}>
                    Processing
                  </Button>
                  <Button type="button" disabled={busy} onClick={() => void setStatus(row.requestId, 'ready')}>
                    Ready
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

export function FieldTripsOpsPage() {
  const { store, loading, save } = useStore();
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const row: FieldTrip = {
      tripId: newId('trip'),
      title: String(form.get('title')),
      tripDate: String(form.get('tripDate')),
      place: String(form.get('place')),
      status: 'open',
      rsvps: [],
    };
    setBusy(true);
    try {
      await save({ ...store, fieldTrips: [...(store.fieldTrips || []), row] });
      event.currentTarget.reset();
    } finally {
      setBusy(false);
    }
  }

  async function rsvp(tripId: string, parentId: string, response: string) {
    const parent = store.users.find((u) => u.userId === parentId);
    setBusy(true);
    try {
      await save({
        ...store,
        fieldTrips: store.fieldTrips.map((t) => {
          if (t.tripId !== tripId) return t;
          const rest = t.rsvps.filter((r) => r.parentId !== parentId);
          return {
            ...t,
            rsvps: [
              ...rest,
              {
                rsvpId: newId('rsvp'),
                parentId,
                studentId: '',
                response,
                contact: parent?.phone || '',
                agreedGuidelines: true,
              },
            ],
          };
        }),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Field trip RSVP</h1>
      <form className="hlc-card form-grid" onSubmit={(e) => void add(e)}>
        <Field label="Title">
          <Input name="title" required />
        </Field>
        <Field label="Date">
          <Input name="tripDate" type="date" defaultValue={todayIsoDate()} />
        </Field>
        <Field label="Place">
          <Input name="place" />
        </Field>
        <Button type="submit" disabled={busy}>
          Add trip
        </Button>
      </form>
      {(store.fieldTrips || []).length === 0 ? <EmptyState title="No records found." /> : null}
      {(store.fieldTrips || []).map((trip) => {
        const yes = trip.rsvps.filter((r) => r.response === 'yes').length;
        return (
          <Card key={trip.tripId} title={trip.title}>
            <p>
              {formatDate(trip.tripDate)} · {trip.place} · Headcount <strong>{yes}</strong>
            </p>
            {store.users
              .filter((u) => u.role === 'parent')
              .map((p) => (
                <p key={p.userId}>
                  {displayName(p)}{' '}
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => void rsvp(trip.tripId, p.userId, 'yes')}>
                    Yes
                  </Button>
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => void rsvp(trip.tripId, p.userId, 'no')}>
                    No
                  </Button>
                </p>
              ))}
          </Card>
        );
      })}
    </>
  );
}

export function FormsOpsPage() {
  const { store, loading, save } = useStore();
  const [studentId, setStudentId] = useState(store.students[0]?.studentId || '');
  const [busy, setBusy] = useState(false);
  if (loading) return <Loading />;

  async function publish() {
    if (store.centerForms.length) return;
    setBusy(true);
    try {
      await save({
        ...store,
        centerForms: STANDARD_FORMS.map((title) => ({
          formId: newId('frm'),
          title,
          fileNote: '',
          status: 'published',
        })),
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(formId: string, signed: boolean) {
    setBusy(true);
    try {
      const existing = store.formSubmissions.find((s) => s.formId === formId && s.studentId === studentId);
      const formSubmissions = existing
        ? store.formSubmissions.map((s) =>
            s.submissionId === existing.submissionId
              ? { ...s, status: signed ? 'signed' : 'outstanding', submittedAt: signed ? todayIsoDate() : '' }
              : s,
          )
        : [
            ...store.formSubmissions,
            {
              submissionId: newId('fsub'),
              formId,
              studentId,
              status: signed ? 'signed' : 'outstanding',
              submittedAt: signed ? todayIsoDate() : '',
            },
          ];
      await save({ ...store, formSubmissions });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Forms & documents</h1>
      <Button type="button" disabled={busy} onClick={() => void publish()}>
        Publish standard library
      </Button>
      <Field label="Student">
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          {store.students.map((s) => (
            <option key={s.studentId} value={s.studentId}>
              {studentDisplay(s)}
            </option>
          ))}
        </Select>
      </Field>
      {(store.centerForms || []).length === 0 ? <EmptyState title="No records found." /> : null}
      {(store.centerForms || []).map((form) => {
        const signed = store.formSubmissions.some((s) => s.formId === form.formId && s.studentId === studentId && s.status === 'signed');
        return (
          <p key={form.formId}>
            {form.title} <StatusBadge status={signed ? 'signed' : 'outstanding'} />{' '}
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void toggle(form.formId, !signed)}>
              {signed ? 'Outstanding' : 'Signed'}
            </Button>
          </p>
        );
      })}
    </>
  );
}

export function PipelineOpsPage() {
  const { store, loading } = useStore();
  const families = useMemo(() => {
    return store.students.map((s) => {
      const parent = store.users.find((u) => u.userId === s.parentId);
      const pay = store.payments.find((x) => x.studentId === s.studentId && ['pending', 'partial', 'overdue'].includes(x.paymentStatus));
      const makeup = (store.makeupRequests || []).some((x) => x.studentId === s.studentId && x.status === 'pending');
      const cert = (store.certificateRequests || []).find((x) => x.studentId === s.studentId);
      let stage = 'confirmation';
      if (pay) stage = 'payment';
      else if (!store.schedules.some((x) => x.studentId === s.studentId)) stage = 'schedule';
      else if (!store.attendance.some((x) => x.studentId === s.studentId)) stage = 'attendance';
      else if (makeup) stage = 'makeup';
      else if (!store.reports.some((x) => x.studentId === s.studentId)) stage = 'progress';
      else if (cert && cert.status !== 'ready') stage = 'certificate';
      return { id: s.studentId, name: studentDisplay(s), parent: parent ? displayName(parent) : 'Not assigned', stage };
    });
  }, [store]);
  if (loading) return <Loading />;
  return (
    <>
      <h1>Family pipeline</h1>
      <div className="grid-cards">
        {FULL_PIPELINE.map((stage) => (
          <Card key={stage} title={stage}>
            {families.filter((f) => f.stage === stage).length === 0 ? (
              <p>No records found.</p>
            ) : (
              families
                .filter((f) => f.stage === stage)
                .map((f) => (
                  <p key={f.id}>
                    <strong>{f.name}</strong> · {f.parent}
                  </p>
                ))
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

export function CalendarOpsBlock() {
  const { store, save } = useStore();
  const [busy, setBusy] = useState(false);
  async function add(event: FormEvent<HTMLFormElement>) {
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
      await save({ ...store, calendarEntries: [...(store.calendarEntries || []), row] });
      event.currentTarget.reset();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title="Calendar categories">
      <form className="form-grid" onSubmit={(e) => void add(e)}>
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
          <Input name="startAt" type="date" defaultValue={todayIsoDate()} required />
        </Field>
        <Field label="End">
          <Input name="endAt" type="date" />
        </Field>
        <Field label="Notes">
          <Input name="notes" />
        </Field>
        <Button type="submit" disabled={busy}>
          Add entry
        </Button>
      </form>
      {(store.calendarEntries || []).map((row) => (
        <p key={row.entryId}>
          {formatDate(row.startAt)} · {CALENDAR_CATEGORIES.find((c) => c.id === row.category)?.label} · {row.title}
        </p>
      ))}
    </Card>
  );
}
