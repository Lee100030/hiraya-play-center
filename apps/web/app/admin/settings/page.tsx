'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { api } from '@/lib/api';
import { Alert, Button, Field, Input, Loading } from '@hiraya/ui';
import { displayName } from '@hiraya/utils';
import { FormEvent, useEffect, useState } from 'react';

const tabs = [
  { id: 'profile', label: 'Profile Settings' },
  { id: 'security', label: 'Account Security' },
  { id: 'notifications', label: 'Notification Preferences' },
  { id: 'system', label: 'System Preferences' },
] as const;

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="switch">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  );
}

export default function AdminSettingsPage() {
  const { user, refreshUser } = useAuth();
  const { store, loading, save, refresh } = useStore();
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('profile');
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [notify, setNotify] = useState({
    attendance: false,
    payments: false,
    schedule: false,
    progress: false,
  });

  useEffect(() => {
    setNotify({
      attendance: store.settings.notifyAttendance,
      payments: store.settings.notifyPayments,
      schedule: store.settings.notifySchedule,
      progress: store.settings.notifyProgress,
    });
  }, [store.settings]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const fullname = String(form.get('fullname') || displayName(user));
    const parts = fullname.split(/\s+/).filter(Boolean);
    try {
      await api.saveProfile({
        firstName: parts[0] || user.firstName,
        lastName: parts.slice(1).join(' ') || user.lastName,
        username: user.username || undefined,
        email: String(form.get('email') || user.email),
        phone: String(form.get('phone') || ''),
        address: String(form.get('address') || ''),
        position: user.position,
      });
      await refreshUser();
      await refresh();
      setOk(true);
      setMessage('Profile saved.');
    } catch (err) {
      setOk(false);
      setMessage(err instanceof Error ? err.message : 'Could not save profile.');
    }
  }

  async function saveSecurity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get('currentPassword') || '');
    const next = String(form.get('newPassword') || '');
    const confirm = String(form.get('confirmPassword') || '');
    if (next !== confirm) {
      setOk(false);
      setMessage('New passwords do not match.');
      return;
    }
    try {
      await api.changePassword(user.userId, currentPassword, next, {
        verificationCode: String(form.get('verificationCode') || ''),
        confirmPassword: confirm,
      });
      setOk(true);
      setMessage('Password updated.');
      setCodeSent(false);
      event.currentTarget.reset();
    } catch (err) {
      setOk(false);
      setMessage(err instanceof Error ? err.message : 'Could not update password.');
    }
  }

  async function sendPasswordCode(formEl: HTMLFormElement) {
    if (!user) return;
    const form = new FormData(formEl);
    setCodeBusy(true);
    try {
      const result = await api.requestPasswordCode(String(form.get('currentPassword') || ''));
      setOk(true);
      setCodeSent(true);
      setMessage(`Verification code sent${result.to ? ` to ${result.to}` : ''}.`);
    } catch (err) {
      setOk(false);
      setMessage(err instanceof Error ? err.message : 'Could not send a verification code.');
    } finally {
      setCodeBusy(false);
    }
  }

  async function saveNotes() {
    await save({
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
    });
    setOk(true);
    setMessage('Notification preferences saved.');
  }

  async function saveSystem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await save({
      ...store,
      settings: {
        ...store.settings,
        centerName: String(form.get('centerName') || store.settings.centerName),
        address: String(form.get('address') || ''),
        phone: String(form.get('phone') || ''),
        email: String(form.get('email') || ''),
        businessHours: String(form.get('businessHours') || ''),
        timeZone: String(form.get('timeZone') || store.settings.timeZone),
        updatedAt: new Date().toISOString(),
      },
    });
    setOk(true);
    setMessage('System preferences saved.');
  }

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Workspace"
        title="Settings"
        description="Keep profile, security, alerts, and center identity in clearly separated cards."
      />
      {message ? <Alert kind={ok ? 'success' : 'danger'}>{message}</Alert> : null}
      <div className="settings-tabs admin-tabs">
        {tabs.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? 'admin-tab active' : 'admin-tab'} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <form className="hlc-card form-grid" onSubmit={saveProfile}>
          <Field label="Display name">
            <Input name="fullname" defaultValue={displayName(user)} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={user?.email} />
          </Field>
          <Field label="Phone">
            <Input name="phone" defaultValue={user?.phone || ''} />
          </Field>
          <Field label="Address">
            <Input name="address" defaultValue={user?.address} />
          </Field>
          <div>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      ) : null}

      {tab === 'security' ? (
        <form className="hlc-card form-grid" onSubmit={saveSecurity}>
          <p className="muted">
            Changing an administrator password requires your current password and a verification code emailed to this
            account. The password is stored as a hash, never in plaintext.
          </p>
          <Field label="Current password">
            <Input name="currentPassword" type="password" required autoComplete="current-password" />
          </Field>
          <Field label="New password">
            <Input name="newPassword" type="password" minLength={8} required autoComplete="new-password" />
          </Field>
          <Field label="Confirm new password">
            <Input name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" />
          </Field>
          <Field label="Email verification code" required>
            <Input name="verificationCode" inputMode="numeric" autoComplete="one-time-code" required={codeSent} />
          </Field>
          <div className="icon-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={codeBusy}
              onClick={(event) => {
                const form = event.currentTarget.closest('form');
                if (form) void sendPasswordCode(form);
              }}
            >
              {codeBusy ? 'Sending…' : 'Email verification code'}
            </Button>
            <Button type="submit">Update password</Button>
          </div>
        </form>
      ) : null}

      {tab === 'notifications' ? (
        <section className="hlc-card">
          <Toggle label="Attendance alerts" checked={notify.attendance} onChange={(value) => setNotify((n) => ({ ...n, attendance: value }))} />
          <Toggle label="Payment alerts" checked={notify.payments} onChange={(value) => setNotify((n) => ({ ...n, payments: value }))} />
          <Toggle label="Schedule alerts" checked={notify.schedule} onChange={(value) => setNotify((n) => ({ ...n, schedule: value }))} />
          <Toggle label="Progress reports" checked={notify.progress} onChange={(value) => setNotify((n) => ({ ...n, progress: value }))} />
          <div style={{ marginTop: 16 }}>
            <Button type="button" onClick={() => void saveNotes()}>
              Save Changes
            </Button>
          </div>
        </section>
      ) : null}

      {tab === 'system' ? (
        <form className="hlc-card form-grid" onSubmit={saveSystem}>
          <Field label="Center name">
            <Input name="centerName" defaultValue={store.settings.centerName} />
          </Field>
          <Field label="Phone">
            <Input name="phone" defaultValue={store.settings.phone || '+63 917 753 4258'} />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={store.settings.email || 'hirayakids.learning@gmail.com'} />
          </Field>
          <Field label="Address">
            <Input name="address" defaultValue={store.settings.address || 'Rodriguez (Montalban), Rizal, Philippines'} />
          </Field>
          <Field label="Business hours">
            <Input name="businessHours" defaultValue={store.settings.businessHours} />
          </Field>
          <Field label="Time zone">
            <Input name="timeZone" defaultValue={store.settings.timeZone} />
          </Field>
          <div>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      ) : null}
    </>
  );
}
