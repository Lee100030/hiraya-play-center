'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTable } from '@/components/admin/AdminTable';
import { useStore } from '@/components/StoreProvider';
import { ProfilePhotoField, saveAccountPhoto } from '@/components/admin/ProfilePhotoField';
import { api } from '@/lib/api';
import { Button, EmptyState, Field, FieldLegend, Input, Loading, Select, StatusBadge, emptyCell } from '@hiraya/ui';
import { displayName, studentDisplay } from '@hiraya/utils';
import type { HirayaUser } from '@hiraya/types';
import { FormEvent, useState } from 'react';

export default function ParentsPage() {
  const { store, loading, refresh } = useStore();
  const [editing, setEditing] = useState<HirayaUser | null | 'new'>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const parents = store.users.filter((u) => u.role === 'parent');
  const current = editing && editing !== 'new' ? editing : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const payload = {
      firstName: String(form.get('firstName') || ''),
      lastName: String(form.get('lastName') || ''),
      email: String(form.get('email') || ''),
      phone: String(form.get('phone') || ''),
      address: String(form.get('address') || ''),
      password,
      confirmPassword: password,
      studentId: String(form.get('studentId') || '') || undefined,
    };
    setError('');
    try {
      if (current) await api.updateParent(current.userId, payload);
      else await api.createParent(payload);
      if (current && payload.studentId) {
        await api.assignParentChild(current.userId, payload.studentId, 'Guardian');
      }
      await refresh();
      if (current?.userId) await saveAccountPhoto(current.userId, form, event.currentTarget);
      setEditing(null);
      setNotice(current ? 'Parent saved.' : 'Parent created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save parent');
    }
  }

  async function unlink(parent: HirayaUser, studentId: string) {
    if (!window.confirm('Remove this child from the parent account?')) return;
    await api.removeParentChild(parent.userId, studentId);
    await refresh();
  }

  async function setActive(parent: HirayaUser, active: boolean) {
    await api.setParentActive(parent.userId, active);
    await refresh();
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
        title="Parent management"
        description="Add, edit, and link children. Parents sign in on mobile; children do not."
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
        empty={<EmptyState title="No parents found" hint="Add a parent or guardian account, then link their children." />}
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
        renderCard={(row) => (
          <article className="admin-stack-card">
            <h3>{displayName(row)}</h3>
            <p>{row.email}</p>
            <StatusBadge status={row.status} />
            <button type="button" className="dash-action" onClick={() => setEditing(row)}>
              Edit
            </button>
          </article>
        )}
      />

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
            <Field label={current ? 'New password' : 'Password'} required={!current} optional={Boolean(current)}>
              <Input name="password" type="password" minLength={current ? undefined : 8} required={!current} />
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
              <Button type="submit">Save</Button>{' '}
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </AdminModal>
      ) : null}
    </>
  );
}
