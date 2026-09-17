'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTable } from '@/components/admin/AdminTable';
import { CertificateModal } from '@/components/admin/CertificateModal';
import { useStore } from '@/components/StoreProvider';
import { api } from '@/lib/api';
import { ProfilePhotoField, saveAccountPhoto } from '@/components/admin/ProfilePhotoField';
import { Button, EmptyState, Field, FieldLegend, Input, Loading, Select, StatusBadge, emptyCell } from '@hiraya/ui';
import { displayName, roleLabel } from '@hiraya/utils';
import type { HirayaUser } from '@hiraya/types';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function AdminStaffPage() {
  const { store, loading, refresh } = useStore();
  const [editing, setEditing] = useState<HirayaUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<HirayaUser | null>(null);
  const [certificate, setCertificate] = useState<HirayaUser | null>(null);
  const [error, setError] = useState('');

  const people = store.users.filter((user) => user.role === 'teacher');
  const current = editing;

  function assignedText(user: HirayaUser) {
    const cls = store.classes.find((item) => item.teacherId === user.userId);
    const program = store.programs.find((item) => item.programId === cls?.programId);
    const specialty = store.teacherProfiles.find((item) => item.userId === user.userId)?.specialty;
    return program?.name || cls?.name || specialty || '';
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    setError('');
    try {
      await api.saveStaff({
        userId: current?.userId,
        fullname: String(form.get('fullname') || ''),
        email: String(form.get('email') || ''),
        phone: String(form.get('phone') || ''),
        role: String(form.get('role') || 'teacher'),
        specialty: String(form.get('specialty') || ''),
        position: String(form.get('position') || ''),
        hireDate: String(form.get('hireDate') || ''),
        status: String(form.get('status') || 'active'),
        password: password || undefined,
        confirmPassword: password || undefined,
      });
      if (current?.userId) await saveAccountPhoto(current.userId, form, event.currentTarget);
      await refresh();
      setEditing(null);
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save staff');
    }
  }

  async function deactivate() {
    if (!removing) return;
    setError('');
    try {
      await api.saveStaff({
        userId: removing.userId,
        fullname: displayName(removing),
        email: removing.email,
        phone: removing.phone || '',
        role: removing.role,
        status: 'deactivated',
      });
      await refresh();
      setRemoving(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update staff');
    }
  }

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Management"
        title="Teachers Management"
        description="Create and monitor teachers, their specialty, and assigned classes."
        actions={
          <button
            type="button"
            className="dash-action dash-action-primary"
            onClick={() => {
              setCreating(true);
              setEditing(null);
            }}
          >
            + Add Teacher
          </button>
        }
      />
      {error ? <p className="hlc-field-error">{error}</p> : null}
      <AdminTable
        rows={people}
        rowKey={(row) => row.userId}
        empty={<EmptyState title="No teachers found" hint="Add a teacher to assign classes and students." />}
        columns={[
          { key: 'name', header: 'Teacher', sortValue: (row) => displayName(row), render: (row) => displayName(row) },
          { key: 'role', header: 'Role', sortValue: (row) => row.role, render: (row) => roleLabel(row.role) },
          { key: 'contact', header: 'Contact', sortValue: (row) => row.email, render: (row) => emptyCell(row.phone || row.email) },
          { key: 'assigned', header: 'Assigned Program / Class', sortValue: (row) => assignedText(row), render: (row) => emptyCell(assignedText(row)) },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) =>
              row.role === 'teacher' ? (
                <div className="icon-actions">
                  <button type="button" className="table-action" onClick={() => setCertificate(row)}>
                    COE
                  </button>
                  <Link className="table-action" href={`/admin/staff/${row.userId}`}>
                    Workspace
                  </Link>
                  <button type="button" className="icon-btn" aria-label={`Edit ${displayName(row)}`} onClick={() => { setEditing(row); setCreating(false); }}>
                    ✎
                  </button>
                  <button type="button" className="icon-btn danger" aria-label={`Deactivate ${displayName(row)}`} onClick={() => setRemoving(row)}>
                    ⌫
                  </button>
                </div>
              ) : (
                <StatusBadge status={row.status} />
              ),
          },
        ]}
        renderCard={(row) => (
          <article className="admin-stack-card">
            <h3>{displayName(row)}</h3>
            <p>{roleLabel(row.role)}</p>
            <p>{row.phone || row.email}</p>
            <p>{emptyCell(assignedText(row))}</p>
            {row.role === 'teacher' ? (
              <div className="icon-actions">
                <button type="button" className="table-action" onClick={() => setCertificate(row)}>
                  COE
                </button>
                <Link className="icon-btn" href={`/admin/staff/${row.userId}`}>
                  Workspace
                </Link>
                <button type="button" className="icon-btn" onClick={() => setEditing(row)}>
                  ✎
                </button>
                <button type="button" className="icon-btn danger" onClick={() => setRemoving(row)}>
                  ⌫
                </button>
              </div>
            ) : null}
          </article>
        )}
      />

      {certificate ? (
        <CertificateModal
          user={certificate}
          profile={store.teacherProfiles.find((item) => item.userId === certificate.userId)}
          settings={store.settings}
          onClose={() => setCertificate(null)}
        />
      ) : null}
      {creating || current ? (
        <AdminModal
          title={current ? `Edit ${displayName(current)}` : 'Add teacher'}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>
                Cancel
              </Button>
              <Button type="submit" form="staff-form">
                Save
              </Button>
            </>
          }
        >
          <form id="staff-form" className="form-grid" onSubmit={onSubmit}>
            <FieldLegend />
            {current ? (
              <ProfilePhotoField userId={current.userId} hasPhoto={Boolean(current.profileImagePath)} cacheKey={current.updatedAt} />
            ) : null}
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
            <Field label="Assigned program / specialty">
              <Input name="specialty" defaultValue={store.teacherProfiles.find((item) => item.userId === current?.userId)?.specialty} />
            </Field>
            <Field label="Position / job title">
              <Input
                name="position"
                defaultValue={store.teacherProfiles.find((item) => item.userId === current?.userId)?.position || current?.position || 'Teacher'}
              />
            </Field>
            <Field label="Date hired">
              <Input
                name="hireDate"
                type="date"
                defaultValue={(store.teacherProfiles.find((item) => item.userId === current?.userId)?.hireDate || '').slice(0, 10)}
              />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={current?.status || 'active'}>
                <option value="active">active</option>
                <option value="deactivated">deactivated</option>
              </Select>
            </Field>
            <Field label={current ? 'New password (optional)' : 'Password'} required={!current}>
              <Input name="password" type="password" minLength={current ? undefined : 8} required={!current} />
            </Field>
          </form>
        </AdminModal>
      ) : null}

      {removing ? (
        <AdminModal
          title="Deactivate teacher"
          description={`Deactivate ${displayName(removing)}?`}
          onClose={() => setRemoving(null)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={() => void deactivate()}>
                Deactivate
              </Button>
            </>
          }
        >
          <p>The account remains in history but can no longer sign in as an active teacher.</p>
        </AdminModal>
      ) : null}
    </>
  );
}
