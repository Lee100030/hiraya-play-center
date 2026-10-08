'use client';

import { AdminPasswordPrompt } from '@/components/admin/AdminPasswordPrompt';
import { useStore } from '@/components/StoreProvider';
import { api } from '@/lib/api';
import { Button, EmptyState, Field, Input, Loading, ProgramSpecialtySelect, Select, StatusBadge, Table } from '@hiraya/ui';
import { displayName, specialtyLaneLabel } from '@hiraya/utils';
import type { HirayaUser } from '@hiraya/types';
import { FormEvent, useState } from 'react';

export default function StaffPage() {
  const { store, loading, refresh } = useStore();
  const [editing, setEditing] = useState<HirayaUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [adminPrompt, setAdminPrompt] = useState<{ form: FormData; formEl: HTMLFormElement } | null>(null);
  const [busy, setBusy] = useState(false);
  const current = editing;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const password = String(form.get('password') || '');
    if (current && password) {
      setError('');
      setAdminPrompt({ form, formEl });
      return;
    }
    await saveStaff(form, formEl, '');
  }

  async function saveStaff(form: FormData, formEl: HTMLFormElement, adminPassword: string) {
    const password = String(form.get('password') || '');
    setError('');
    setBusy(true);
    try {
      await api.saveStaff({
        userId: current?.userId,
        fullname: String(form.get('fullname') || ''),
        email: String(form.get('email') || ''),
        phone: String(form.get('phone') || ''),
        role: String(form.get('role') || 'teacher'),
        specialty: String(form.get('specialty') || ''),
        status: String(form.get('status') || 'active'),
        password: password || undefined,
        confirmPassword: password || undefined,
        adminPassword: adminPassword || undefined,
      });
      await refresh();
      setAdminPrompt(null);
      setEditing(null);
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save staff');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  const people = store.users.filter((u) => ['teacher', 'staff', 'admin', 'super_admin'].includes(u.role));

  return (
    <>
      <div className="toolbar">
        <h1>Teachers & staff</h1>
        <Button type="button" onClick={() => { setCreating(true); setEditing(null); }}>
          Add
        </Button>
      </div>
      {error ? <p className="hlc-field-error">{error}</p> : null}
      {(creating || current) && ['teacher', 'staff'].includes(current?.role || 'teacher') ? (
        <form className="hlc-card form-grid" onSubmit={onSubmit}>
          <Field label="Full name" required>
            <Input name="fullname" defaultValue={current ? displayName(current) : ''} required />
          </Field>
          <Field label="Email" required>
            <Input name="email" type="email" defaultValue={current?.email} required />
          </Field>
          <Field label="Role">
            <Select name="role" defaultValue={current?.role || 'teacher'}>
              <option value="teacher">teacher</option>
            </Select>
          </Field>
          <Field label="Phone">
            <Input name="phone" defaultValue={current?.phone || ''} />
          </Field>
          <Field
            label="Specialization"
            hint="Playgroup, Pre-kinder, Kinder, Nursery, Grade 1–3, ABA Therapy, or Tutorial Session. That teacher appears in the matching Teachers Management list."
          >
            <ProgramSpecialtySelect value={store.teacherProfiles.find((p) => p.userId === current?.userId)?.specialty} store={store} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={current?.status || 'active'}>
              <option value="active">active</option>
              <option value="deactivated">deactivated</option>
            </Select>
          </Field>
          <Field label={current ? 'Set new password' : 'Password'} required={!current} optional={Boolean(current)}>
            <Input name="password" type="password" autoComplete="new-password" placeholder={current ? '••••••••' : undefined} minLength={current ? undefined : 8} required={!current} />
          </Field>
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : current ? 'Save' : 'Create'}
            </Button>{' '}
            <Button type="button" variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {people.length === 0 ? (
        <EmptyState title="No staff records" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Email</th>
              <th>Program</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.userId}>
                <td>{displayName(person)}</td>
                <td>{person.role}</td>
                <td>{person.email}</td>
                <td>{specialtyLaneLabel(store.teacherProfiles.find((p) => p.userId === person.userId)?.specialty)}</td>
                <td>
                  <StatusBadge status={person.status} />
                </td>
                <td>
                  {person.role === 'teacher' || person.role === 'staff' ? (
                    <Button type="button" variant="ghost" onClick={() => { setEditing(person); setCreating(false); }}>
                      Edit
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {adminPrompt ? (
        <AdminPasswordPrompt
          busy={busy}
          error={error || null}
          onClose={() => {
            if (busy) return;
            setAdminPrompt(null);
            setError('');
          }}
          onConfirm={(adminPassword) => void saveStaff(adminPrompt.form, adminPrompt.formEl, adminPassword)}
        />
      ) : null}
    </>
  );
}
