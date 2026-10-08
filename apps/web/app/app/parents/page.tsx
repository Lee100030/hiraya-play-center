'use client';

import { AdminProfileFact, AdminProfileModal } from '@/components/admin/AdminProfileModal';
import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPasswordPrompt } from '@/components/admin/AdminPasswordPrompt';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTable } from '@/components/admin/AdminTable';
import { useStore } from '@/components/StoreProvider';
import { ProfilePhotoField, saveAccountPhoto } from '@/components/admin/ProfilePhotoField';
import { api } from '@/lib/api';
import { Button, EmptyState, Field, FieldLegend, Input, Loading, PersonAvatar, Select, StatusBadge, emptyCell } from '@hiraya/ui';
import { displayName, laneLabel, parentInLane, parsePeopleLane, roleLabel, studentDisplay } from '@hiraya/utils';
import type { HirayaUser } from '@hiraya/types';
import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ParentsPage() {
  const { store, loading, refresh } = useStore();
  const lane = parsePeopleLane(useSearchParams().get('lane'), store);
  const [editing, setEditing] = useState<HirayaUser | null | 'new'>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [viewing, setViewing] = useState<HirayaUser | null>(null);
  const [adminPrompt, setAdminPrompt] = useState<{ form: FormData; formEl: HTMLFormElement } | null>(null);
  const [busy, setBusy] = useState(false);
  const parents = store.users.filter((u) => u.role === 'parent' && parentInLane(store, u.userId, lane));
  const current = editing && editing !== 'new' ? editing : null;

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
    await saveParent(form, formEl, '');
  }

  async function saveParent(form: FormData, formEl: HTMLFormElement, adminPassword: string) {
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    const payload = {
      firstName: String(form.get('firstName') || ''),
      lastName: String(form.get('lastName') || ''),
      email: String(form.get('email') || ''),
      phone: String(form.get('phone') || ''),
      address: String(form.get('address') || ''),
      password,
      confirmPassword: confirmPassword || password,
      adminPassword,
      studentId: String(form.get('studentId') || '') || undefined,
    };
    setError('');
    setBusy(true);
    try {
      if (current) await api.updateParent(current.userId, payload);
      else await api.createParent(payload);
      if (current && payload.studentId) {
        await api.assignParentChild(current.userId, payload.studentId, 'Guardian');
      }
      await refresh();
      if (current?.userId) await saveAccountPhoto(current.userId, form, formEl);
      setAdminPrompt(null);
      setEditing(null);
      setNotice(current ? 'Parent saved.' : 'Parent created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save parent');
    } finally {
      setBusy(false);
    }
  }

  async function unlink(parent: HirayaUser, studentId: string) {
    if (!window.confirm('Remove this child from the parent account?')) return;
    await api.removeParentChild(parent.userId, studentId);
    await refresh();
  }

  async function setActive(parent: HirayaUser, active: boolean) {
    const pending = (parent.status || '').toLowerCase().includes('pending');
    if (active && pending) {
      setViewing(null);
      setEditing(parent);
      setError(
        'This parent is waiting for activation. Set a password (at least 8 characters), then Save and confirm with your admin password. That turns the account on for the phone app.',
      );
      return;
    }
    try {
      await api.setParentActive(parent.userId, active);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update parent status.');
    }
  }

  async function remove(parent: HirayaUser) {
    if (!window.confirm(`Permanently delete ${displayName(parent)}? Linked children stay on file.`)) return;
    await api.deleteParent(parent.userId);
    await refresh();
  }

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Management"
        title={lane ? `Parent management · ${laneLabel(lane)}` : 'Parent management'}
        description={
          lane
            ? `Guardians with children in ${laneLabel(lane)}.`
            : 'Add, edit, and link children. Parents sign in on mobile; children do not.'
        }
        actions={
          <button type="button" className="dash-action dash-action-primary" onClick={() => setEditing('new')}>
            + Add Parent
          </button>
        }
      />
      {notice ? <p className="field-success">{notice}</p> : null}
      {error && !editing ? <p className="hlc-field-error">{error}</p> : null}
      <AdminTable
        rows={parents}
        rowKey={(row) => row.userId}
        preferCards
        selectable
        onRefresh={() => void refresh()}
        cardName={(row) => displayName(row)}
        empty={<EmptyState title="No parents found" hint="Add a parent or guardian account, then link their children." />}
        onRowOpen={(row) => setViewing(row)}
        columns={[
          { key: 'name', header: 'Name', sortValue: (row) => displayName(row), render: (row) => displayName(row) },
          { key: 'email', header: 'Email', sortValue: (row) => row.email, render: (row) => emptyCell(row.email) },
          {
            key: 'children',
            header: 'Children',
            render: (row) => {
              const kids = store.parentStudents.filter((l) => l.parentId === row.userId && l.isActive);
              if (!kids.length) return emptyCell('');
              return kids.map((link) => (
                <span key={link.parentStudentId} style={{ display: 'inline-block', marginRight: 8 }}>
                  {store.students.find((s) => s.studentId === link.studentId)
                    ? studentDisplay(store.students.find((s) => s.studentId === link.studentId)!)
                    : link.studentId}{' '}
                  <Button type="button" variant="ghost" onClick={() => void unlink(row, link.studentId)}>
                    Unlink
                  </Button>
                </span>
              ));
            },
          },
          { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="icon-actions">
                <button type="button" className="table-action" onClick={() => setEditing(row)}>
                  Edit
                </button>
                {row.status === 'active' ? (
                  <button type="button" className="table-action" onClick={() => void setActive(row, false)}>
                    Archive
                  </button>
                ) : (
                  <button type="button" className="table-action" onClick={() => void setActive(row, true)}>
                    Restore
                  </button>
                )}
                <button type="button" className="icon-btn danger" onClick={() => void remove(row)}>
                  Delete
                </button>
              </div>
            ),
          },
        ]}
        renderCard={(row) => {
          const n = store.parentStudents.filter((l) => l.parentId === row.userId && l.isActive).length;
          return (
            <article className="people-card">
              <PersonAvatar
                name={displayName(row)}
                photo={row.profileImagePath ? api.profileMediaUrl(row.userId, row.updatedAt || row.profileImagePath) : undefined}
                size="lg"
              />
              <h3>{displayName(row)}</h3>
              <p className="people-card-role">{roleLabel(row.role)}</p>
              <p className="people-card-stat">{n ? `${n} linked children` : 'No children linked'}</p>
            </article>
          );
        }}
      />

      {viewing ? (
        <AdminProfileModal
          title="Parent profile"
          name={displayName(viewing)}
          subtitle={roleLabel(viewing.role)}
          status={viewing.status}
          photo={viewing.profileImagePath ? api.profileMediaUrl(viewing.userId, viewing.updatedAt || viewing.profileImagePath) : undefined}
          active={viewing.status === 'active'}
          onToggleActive={(next) => {
            void setActive(viewing, next);
            setViewing({ ...viewing, status: next ? 'active' : 'deactivated' });
          }}
          onClose={() => setViewing(null)}
          actions={
            <>
              <Button type="button" variant="ghost" onClick={() => setViewing(null)}>
                Close
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditing(viewing);
                  setViewing(null);
                }}
              >
                Link child
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setEditing(viewing);
                  setViewing(null);
                }}
              >
                Edit
              </Button>
            </>
          }
        >
          <AdminProfileFact label="Email">{emptyCell(viewing.email)}</AdminProfileFact>
          <AdminProfileFact label="Phone">{emptyCell(viewing.phone)}</AdminProfileFact>
          <AdminProfileFact label="Children">
            {emptyCell(
              store.parentStudents
                .filter((l) => l.parentId === viewing.userId && l.isActive)
                .map((link) => {
                  const student = store.students.find((s) => s.studentId === link.studentId);
                  return student ? studentDisplay(student) : link.studentId;
                })
                .join(', '),
            )}
          </AdminProfileFact>
        </AdminProfileModal>
      ) : null}

      {editing ? (
        <AdminModal title={current ? `Edit ${displayName(current)}` : 'Add parent'} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={onSubmit}>
            <FieldLegend />
            {error ? <p className="hlc-field-error">{error}</p> : null}
            {current ? (
              <ProfilePhotoField userId={current.userId} hasPhoto={Boolean(current.profileImagePath)} cacheKey={current.updatedAt} />
            ) : null}
            <Field label="First name" required>
              <Input name="firstName" defaultValue={current?.firstName} required />
            </Field>
            <Field label="Last name" required>
              <Input name="lastName" defaultValue={current?.lastName} required />
            </Field>
            <Field label="Email" required>
              <Input name="email" type="email" defaultValue={current?.email} required />
            </Field>
            <Field label="Phone" required>
              <Input name="phone" defaultValue={current?.phone || ''} required />
            </Field>
            <Field label="Address" required>
              <Input name="address" defaultValue={current?.address || ''} required />
            </Field>
            {current ? (
              <p className="muted">
                Current password is stored as a hash and cannot be shown. Leave blank to keep it. Save will ask for your
                administrator password if you set a new one.
              </p>
            ) : null}
            <Field label={current ? 'Set new password' : 'Password'} required={!current} optional={Boolean(current)}>
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder={current ? '••••••••' : undefined}
                minLength={current ? undefined : 8}
                required={!current}
              />
            </Field>
            <Field label="Confirm password" required={!current} optional={Boolean(current)}>
              <Input name="confirmPassword" type="password" autoComplete="new-password" required={!current} />
            </Field>
            {current ? (
              <div className="form-span">
                <h3>Linked children</h3>
                {store.parentStudents
                  .filter((l) => l.parentId === current.userId && l.isActive)
                  .map((link) => {
                    const child = store.students.find((s) => s.studentId === link.studentId);
                    return (
                      <p key={link.parentStudentId}>
                        {child ? studentDisplay(child) : link.studentId}{' '}
                        <Button type="button" variant="ghost" onClick={() => void unlink(current, link.studentId)}>
                          Unlink
                        </Button>
                      </p>
                    );
                  })}
                <Field label="Link another child" optional>
                  <Select name="studentId" defaultValue="">
                    <option value="">None</option>
                    {store.students.map((student) => (
                      <option key={student.studentId} value={student.studentId}>
                        {studentDisplay(student)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : (
              <Field label="Link student" optional>
                <Select name="studentId" defaultValue="">
                  <option value="">None yet</option>
                  {store.students.map((student) => (
                    <option key={student.studentId} value={student.studentId}>
                      {studentDisplay(student)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <div>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </Button>{' '}
              <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </form>
        </AdminModal>
      ) : null}
      {adminPrompt ? (
        <AdminPasswordPrompt
          busy={busy}
          error={error || null}
          onClose={() => {
            if (busy) return;
            setAdminPrompt(null);
            setError('');
          }}
          onConfirm={(adminPassword) => void saveParent(adminPrompt.form, adminPrompt.formEl, adminPassword)}
        />
      ) : null}
    </>
  );
}
