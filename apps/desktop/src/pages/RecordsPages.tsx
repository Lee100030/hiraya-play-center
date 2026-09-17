import type { AttendanceRecord, HirayaDatabase, HirayaUser, Payment, ProgressReport } from '@hiraya/types';
import { displayName, newId, roleLabel, studentDisplay, todayIsoDate } from '@hiraya/utils';
import { Field, Input, Select, Textarea, Button } from '@hiraya/ui';
import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { EditorModal, FormSection } from '../components/EditorModal';
import { PageHeader } from '../components/PageHeader';
import { RecordTable, StatusCell } from '../components/RecordTable';
import { PAGE_COPY } from '../lib/views';

function studentName(store: HirayaDatabase, studentId?: string) {
  const student = store.students.find((item) => item.studentId === studentId);
  return student ? studentDisplay(student) : studentId || '—';
}

export function AttendanceManagePage({
  store,
  user,
  saveStore,
  onRefresh,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const studentId = String(form.get('studentId') || '');
    const attendanceDate = String(form.get('attendanceDate') || todayIsoDate());
    if (store.attendance.some((row) => row.kind === 'student' && row.studentId === studentId && row.attendanceDate === attendanceDate)) {
      setError('That student already has attendance for this date.');
      return;
    }
    const next: AttendanceRecord = {
      attendanceId: newId('att'),
      kind: 'student',
      studentId,
      employeeId: '',
      classId: String(form.get('classId') || ''),
      qrCode: '',
      timeIn: new Date().toISOString(),
      timeOut: null,
      attendanceDate,
      status: String(form.get('status') || 'present'),
      notes: String(form.get('notes') || ''),
      recordedBy: user.userId,
    };
    await saveStore({ ...store, attendance: [next, ...store.attendance] });
    setOpen(false);
    setError(null);
  }

  return (
    <>
      <RecordTable
        title={PAGE_COPY.attendance.title}
        description={PAGE_COPY.attendance.description}
        rows={store.attendance}
        search={(row, q) => `${row.studentId} ${row.status} ${row.attendanceDate}`.toLowerCase().includes(q)}
        searchPlaceholder="Search attendance"
        emptyTitle="No attendance records"
        emptyHint="Record attendance here; it appears on website admin and parent mobile."
        statusOf={(row) => row.status}
        crud={{ addLabel: '+ Record attendance', onAdd: () => setOpen(true), onRefresh }}
        columns={[
          { key: 'date', header: 'Date', render: (row) => row.attendanceDate },
          { key: 'who', header: 'Student', render: (row) => studentName(store, row.studentId) },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
        ]}
      />
      {open ? (
        <EditorModal title="Record attendance" error={error} submitLabel="Save" onClose={() => setOpen(false)} onSubmit={onSubmit}>
          <FormSection title="Attendance">
            <Field label="Student" required>
              <Select name="studentId" required>
                <option value="">Select</option>
                {store.students.map((item) => (
                  <option key={item.studentId} value={item.studentId}>
                    {studentDisplay(item)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input name="attendanceDate" type="date" defaultValue={todayIsoDate()} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue="present">
                <option value="present">present</option>
                <option value="late">late</option>
                <option value="absent">absent</option>
                <option value="excused">excused</option>
              </Select>
            </Field>
          </FormSection>
        </EditorModal>
      ) : null}
    </>
  );
}

export function ProgressManagePage({
  store,
  user,
  saveStore,
  onRefresh,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    const next: ProgressReport = {
      reportId: newId('prgnote'),
      studentId: String(form.get('studentId') || ''),
      teacherId: user.userId,
      classId: '',
      period: String(form.get('period') || ''),
      area: String(form.get('area') || ''),
      rating: String(form.get('rating') || ''),
      evaluation: String(form.get('evaluation') || ''),
      behaviorReport: '',
      developmentalReport: '',
      remarks: String(form.get('remarks') || ''),
      uploadedMedia: '',
      status: 'published',
      createdAt: now,
      updatedAt: now,
      history: [],
    };
    await saveStore({ ...store, reports: [next, ...store.reports] });
    setOpen(false);
  }

  return (
    <>
      <RecordTable
        title={PAGE_COPY.progress.title}
        description={PAGE_COPY.progress.description}
        rows={store.reports}
        search={(row, q) => `${row.area} ${row.rating} ${row.studentId}`.toLowerCase().includes(q)}
        searchPlaceholder="Search progress"
        emptyTitle="No progress records"
        emptyHint="Add a progress note; parents see published notes for linked children."
        statusOf={(row) => row.status}
        crud={{ addLabel: '+ Add progress', onAdd: () => setOpen(true), onRefresh }}
        columns={[
          { key: 'student', header: 'Student', render: (row) => studentName(store, row.studentId) },
          { key: 'area', header: 'Area', render: (row) => row.area || '—' },
          { key: 'rating', header: 'Rating', render: (row) => row.rating || '—' },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
        ]}
      />
      {open ? (
        <EditorModal title="Add progress" submitLabel="Save" onClose={() => setOpen(false)} onSubmit={onSubmit}>
          <FormSection title="Progress">
            <Field label="Student" required>
              <Select name="studentId" required>
                <option value="">Select</option>
                {store.students.map((item) => (
                  <option key={item.studentId} value={item.studentId}>
                    {studentDisplay(item)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Area">
              <Input name="area" />
            </Field>
            <Field label="Rating">
              <Input name="rating" />
            </Field>
            <Field label="Remarks">
              <Textarea name="evaluation" />
            </Field>
          </FormSection>
        </EditorModal>
      ) : null}
    </>
  );
}

export function PaymentsManagePage({
  store,
  user,
  saveStore,
  onRefresh,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const next: Payment = {
      paymentId: newId('pay'),
      enrollmentId: '',
      studentId: String(form.get('studentId') || ''),
      amount: Number(form.get('amount') || 0),
      amountPaid: Number(form.get('amountPaid') || 0),
      paymentMethod: String(form.get('paymentMethod') || 'cash'),
      paymentStatus: String(form.get('paymentStatus') || 'pending'),
      referenceNumber: String(form.get('referenceNumber') || ''),
      paymentDate: new Date().toISOString().slice(0, 10),
      dueAt: '',
      paidAt: '',
      recordedBy: user.userId,
      notes: String(form.get('notes') || ''),
      history: [],
    };
    await saveStore({ ...store, payments: [...store.payments, next] });
    setOpen(false);
  }

  return (
    <>
      <RecordTable
        title={PAGE_COPY.payments.title}
        description={PAGE_COPY.payments.description}
        rows={store.payments}
        search={(row, q) => `${row.studentId} ${row.paymentStatus} ${row.referenceNumber}`.toLowerCase().includes(q)}
        searchPlaceholder="Search payments"
        emptyTitle="No payments found"
        emptyHint="Add a charge; the same row appears on website admin and parent mobile."
        statusOf={(row) => row.paymentStatus}
        crud={{ addLabel: '+ Add charge', onAdd: () => setOpen(true), onRefresh }}
        columns={[
          { key: 'student', header: 'Student', render: (row) => studentName(store, row.studentId) },
          { key: 'amount', header: 'Amount', render: (row) => `₱${Number(row.amount || 0).toLocaleString()}` },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.paymentStatus} /> },
        ]}
      />
      {open ? (
        <EditorModal title="Add charge" submitLabel="Save" onClose={() => setOpen(false)} onSubmit={onSubmit}>
          <FormSection title="Payment">
            <Field label="Student" required>
              <Select name="studentId" required>
                <option value="">Select</option>
                {store.students.map((item) => (
                  <option key={item.studentId} value={item.studentId}>
                    {studentDisplay(item)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount">
              <Input name="amount" type="number" min={0} />
            </Field>
            <Field label="Amount paid">
              <Input name="amountPaid" type="number" min={0} />
            </Field>
            <Field label="Method">
              <Input name="paymentMethod" defaultValue="cash" />
            </Field>
          </FormSection>
        </EditorModal>
      ) : null}
    </>
  );
}

const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Password' },
  { id: 'notifications', label: 'Alerts' },
  { id: 'system', label: 'Center' },
] as const;

export function SettingsPage({
  store,
  user,
  saveStore,
  onRefresh,
  onUser,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
  onUser?: (next: HirayaUser) => void;
}) {
  const live = store.users.find((item) => item.userId === user.userId) || user;
  const [tab, setTab] = useState<(typeof SETTINGS_TABS)[number]['id']>('profile');
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notify, setNotify] = useState({
    attendance: store.settings.notifyAttendance,
    payments: store.settings.notifyPayments,
    schedule: store.settings.notifySchedule,
    progress: store.settings.notifyProgress,
  });

  async function run(task: () => Promise<void>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      setOk(true);
      setMessage(done);
    } catch (err) {
      setOk(false);
      setMessage(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get('firstName') || '').trim();
    const lastName = String(form.get('lastName') || '').trim();
    const fullname = String(form.get('fullname') || '').trim();
    const parts = fullname.split(/\s+/).filter(Boolean);
    await run(async () => {
      const saved = await api.saveProfile({
        firstName: firstName || parts[0] || live.firstName,
        lastName: lastName || parts.slice(1).join(' ') || live.lastName,
        middleName: live.middleName || '',
        username: live.username,
        email: String(form.get('email') || live.email).trim(),
        phone: String(form.get('phone') || ''),
        address: String(form.get('address') || ''),
        position: live.position || '',
      });
      onUser?.(saved);
      await onRefresh?.();
    }, 'Profile saved.');
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = String(form.get('newPassword') || '');
    if (next !== String(form.get('confirmPassword') || '')) {
      setOk(false);
      setMessage('New passwords do not match.');
      return;
    }
    await run(async () => {
      await api.changePassword(live.userId, String(form.get('currentPassword') || ''), next);
      event.currentTarget.reset();
    }, 'Password updated. Other signed-in sessions must sign in again.');
  }

  async function saveAlerts() {
    await run(
      () =>
        saveStore({
          ...store,
          settings: {
            ...store.settings,
            notifyAttendance: notify.attendance,
            notifyPayments: notify.payments,
            notifySchedule: notify.schedule,
            notifyProgress: notify.progress,
            notificationsEnabled: notify.attendance || notify.payments || notify.schedule || notify.progress,
            updatedAt: new Date().toISOString(),
          },
        }),
      'Alert preferences saved.',
    );
  }

  async function saveCenter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await run(
      () =>
        saveStore({
          ...store,
          settings: {
            ...store.settings,
            centerName: String(form.get('centerName') || store.settings.centerName),
            phone: String(form.get('phone') || ''),
            email: String(form.get('email') || ''),
            address: String(form.get('address') || ''),
            website: String(form.get('website') || ''),
            businessHours: String(form.get('businessHours') || ''),
            timeZone: String(form.get('timeZone') || store.settings.timeZone),
            defaultPeriod: String(form.get('defaultPeriod') || store.settings.defaultPeriod),
            defaultAttendanceStatus: String(form.get('defaultAttendanceStatus') || store.settings.defaultAttendanceStatus),
            defaultPaymentMethod: String(form.get('defaultPaymentMethod') || store.settings.defaultPaymentMethod),
            updatedAt: new Date().toISOString(),
          },
        }),
      'Center settings saved. Website admin and the public site read the same record.',
    );
  }

  return (
    <>
      <PageHeader title={PAGE_COPY.settings.title} description={PAGE_COPY.settings.description} />
      {message ? <p className={ok ? 'muted' : 'hlc-field-error'}>{message}</p> : null}
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {SETTINGS_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'settings-tab is-active' : 'settings-tab'}
            onClick={() => {
              setTab(item.id);
              setMessage(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <form key={live.updatedAt} className="panel settings-form" onSubmit={saveProfile}>
          <h2>Administrator profile</h2>
          <p className="muted">
            Signed in as {roleLabel(live.role)} · {live.username || live.email}
          </p>
          <Field label="Display name">
            <Input name="fullname" defaultValue={displayName(live)} />
          </Field>
          <Field label="First name">
            <Input name="firstName" defaultValue={live.firstName} />
          </Field>
          <Field label="Last name">
            <Input name="lastName" defaultValue={live.lastName} />
          </Field>
          <Field label="Email" required>
            <Input name="email" type="email" defaultValue={live.email} required />
          </Field>
          <Field label="Phone">
            <Input name="phone" defaultValue={live.phone || ''} />
          </Field>
          <Field label="Address">
            <Input name="address" defaultValue={live.address || ''} />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      ) : null}

      {tab === 'security' ? (
        <form className="panel settings-form" onSubmit={savePassword}>
          <h2>Password</h2>
          <Field label="Current password">
            <Input name="currentPassword" type="password" required autoComplete="current-password" />
          </Field>
          <Field label="New password">
            <Input name="newPassword" type="password" minLength={8} required autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password">
            <Input name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Update password'}
          </Button>
        </form>
      ) : null}

      {tab === 'notifications' ? (
        <section className="panel settings-form">
          <h2>Alert preferences</h2>
          <p className="muted">These flags are stored on the center settings record shared with the website.</p>
          {(
            [
              ['attendance', 'Attendance alerts'],
              ['payments', 'Payment alerts'],
              ['schedule', 'Schedule alerts'],
              ['progress', 'Progress reports'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="settings-check">
              <input
                type="checkbox"
                checked={notify[key]}
                onChange={(event) => setNotify((current) => ({ ...current, [key]: event.target.checked }))}
              />
              {label}
            </label>
          ))}
          <Button type="button" disabled={busy} onClick={() => void saveAlerts()}>
            {busy ? 'Saving…' : 'Save alerts'}
          </Button>
        </section>
      ) : null}

      {tab === 'system' ? (
        <form key={store.settings.updatedAt} className="panel settings-form" onSubmit={saveCenter}>
          <h2>Center identity</h2>
          <Field label="Center name" required>
            <Input name="centerName" defaultValue={store.settings.centerName} required />
          </Field>
          <Field label="Phone">
            <Input name="phone" defaultValue={store.settings.phone} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={store.settings.email} />
          </Field>
          <Field label="Website">
            <Input name="website" defaultValue={store.settings.website} />
          </Field>
          <Field label="Address">
            <Input name="address" defaultValue={store.settings.address} />
          </Field>
          <Field label="Business hours">
            <Input name="businessHours" defaultValue={store.settings.businessHours} />
          </Field>
          <Field label="Time zone">
            <Input name="timeZone" defaultValue={store.settings.timeZone} />
          </Field>
          <Field label="Default period">
            <Input name="defaultPeriod" defaultValue={store.settings.defaultPeriod} />
          </Field>
          <Field label="Default attendance status">
            <Select name="defaultAttendanceStatus" defaultValue={store.settings.defaultAttendanceStatus || 'present'}>
              <option value="present">present</option>
              <option value="late">late</option>
              <option value="absent">absent</option>
              <option value="excused">excused</option>
            </Select>
          </Field>
          <Field label="Default payment method">
            <Input name="defaultPaymentMethod" defaultValue={store.settings.defaultPaymentMethod} />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save center settings'}
          </Button>
        </form>
      ) : null}
    </>
  );
}

export function WebsiteCmsPage({
  store,
  onRefresh,
}: {
  store: HirayaDatabase;
  onRefresh?: () => Promise<void> | void;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const s = store.settings;

  async function saveLanding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api.saveWebsiteLanding(String(form.get('welcomeTitle') || ''), String(form.get('welcomeMessage') || ''));
      await onRefresh?.();
      setMessage('Landing saved. The public website reads this from the API.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save landing.');
    } finally {
      setBusy(false);
    }
  }

  async function saveAbout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api.saveWebsiteAbout({
        aboutTitle: String(form.get('aboutTitle') || ''),
        description: String(form.get('description') || ''),
        mission: String(form.get('mission') || ''),
        vision: String(form.get('vision') || ''),
        values: String(form.get('values') || ''),
      });
      await onRefresh?.();
      setMessage('About page saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save about.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Marketing site"
        description="Landing and About copy for the public website. Same API used by website admin."
      />
      {message ? <p className="muted">{message}</p> : null}
      <form className="panel" style={{ display: 'grid', gap: 12, marginBottom: 16 }} onSubmit={saveLanding}>
        <h2>Landing</h2>
        <Field label="Welcome title">
          <Input name="welcomeTitle" defaultValue={s.welcomeTitle} />
        </Field>
        <Field label="Welcome message">
          <Textarea name="welcomeMessage" defaultValue={s.welcomeMessage} />
        </Field>
        <Button type="submit" disabled={busy}>
          Save landing
        </Button>
      </form>
      <form className="panel" style={{ display: 'grid', gap: 12 }} onSubmit={saveAbout}>
        <h2>About</h2>
        <Field label="About title">
          <Input name="aboutTitle" defaultValue={s.aboutTitle} />
        </Field>
        <Field label="Description">
          <Textarea name="description" defaultValue={s.description} />
        </Field>
        <Field label="Mission">
          <Textarea name="mission" defaultValue={s.mission} />
        </Field>
        <Field label="Vision">
          <Textarea name="vision" defaultValue={s.vision} />
        </Field>
        <Field label="Values">
          <Textarea name="values" defaultValue={s.values} />
        </Field>
        <Button type="submit" disabled={busy}>
          Save about
        </Button>
      </form>
    </>
  );
}
