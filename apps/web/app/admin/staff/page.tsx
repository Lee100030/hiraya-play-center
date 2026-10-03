'use client';

import { AdminProfileFact, AdminProfileModal } from '@/components/admin/AdminProfileModal';
import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTable } from '@/components/admin/AdminTable';
import { CertificateModal } from '@/components/admin/CertificateModal';
import { useStore } from '@/components/StoreProvider';
import { api } from '@/lib/api';
import { ProfilePhotoField, saveAccountPhoto } from '@/components/admin/ProfilePhotoField';
import { Button, EmptyState, Field, FieldLegend, Input, Loading, PersonAvatar, ProgramSpecialtySelect, Select, StatusBadge, assignedCount, emptyCell } from '@hiraya/ui';
import { displayName, laneLabel, parsePeopleLane, specialtyLaneLabel, staffDisplayRole, teacherInLane, assignedStudentsForTeacher, openTaskCountForTeacher } from '@hiraya/utils';
import type { HirayaUser } from '@hiraya/types';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AdminStaffPage() {
  const { store, loading, refresh } = useStore();
  const lane = parsePeopleLane(useSearchParams().get('lane'), store);
  const [editing, setEditing] = useState<HirayaUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<HirayaUser | null>(null);
  const [certificate, setCertificate] = useState<HirayaUser | null>(null);
  const [viewing, setViewing] = useState<HirayaUser | null>(null);
  const [error, setError] = useState('');

  const people = store.users.filter((user) => user.role === 'teacher' && teacherInLane(store, user.userId, lane));
  const current = editing;
  const viewingLive = viewing ? store.users.find((item) => item.userId === viewing.userId) || viewing : null;

  function assignedText(user: HirayaUser) {
    const cls = store.classes.find((item) => item.teacherId === user.userId);
    const program = store.programs.find((item) => item.programId === cls?.programId);
    const specialty = store.teacherProfiles.find((item) => item.userId === user.userId)?.specialty;
    return program?.name || cls?.name || specialtyLaneLabel(specialty) || '';
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
      await api.setStaffActive(removing.userId, false);
      await refresh();
      setRemoving(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update staff');
    }
  }

  async function setTeacherActive(row: HirayaUser, active: boolean) {
    setError('');
    try {
      await api.setStaffActive(row.userId, active);
      await refresh();
      setViewing((currentView) => (currentView?.userId === row.userId ? { ...currentView, status: active ? 'active' : 'deactivated' } : currentView));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update teacher status');
    }
  }

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Management"
        title={lane ? `Teachers Management · ${laneLabel(lane)}` : 'Teachers Management'}
        description={lane ? `Teachers assigned to ${laneLabel(lane)}.` : 'Create and monitor teachers, their program, and assigned classes.'}
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
        preferCards
        selectable
        onRefresh={() => void refresh()}
        cardName={(row) => displayName(row)}
        empty={<EmptyState title="No teachers found" hint="Add a teacher to assign classes and students." />}
        onRowOpen={(row) => setViewing(row)}
        columns={[
          {
            key: 'name',
            header: 'Teacher',
            sortValue: (row) => displayName(row),
            render: (row) => (
              <span className="name-cell">
                <PersonAvatar
                  name={displayName(row)}
                  photo={row.profileImagePath ? api.profileMediaUrl(row.userId, row.updatedAt || row.profileImagePath) : undefined}
                  size="sm"
                />
                {displayName(row)}
              </span>
            ),
          },
          { key: 'role', header: 'Role', sortValue: (row) => row.role, render: (row) => staffDisplayRole(row.role, store.teacherProfiles.find((item) => item.userId === row.userId)?.specialty) },
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
        renderCard={(row) => {
          const specialty = store.teacherProfiles.find((item) => item.userId === row.userId)?.specialty;
          const kids = assignedStudentsForTeacher(store, row.userId).length;
          const open = openTaskCountForTeacher(store, row.userId);
          const program = specialtyLaneLabel(specialty) || 'Program not set';
          return (
            <article className="people-card">
              <PersonAvatar
                name={displayName(row)}
                photo={row.profileImagePath ? api.profileMediaUrl(row.userId, row.updatedAt || row.profileImagePath) : undefined}
                size="lg"
              />
              <h3>{displayName(row)}</h3>
              <p className="people-card-role">{staffDisplayRole(row.role, specialty)}</p>
              <p className="people-card-stat">{`${program} · ${open} open tasks · ${kids} assigned students`}</p>
            </article>
          );
        }}
      />

      {viewingLive ? (
        <AdminProfileModal
          title="Teacher profile"
          name={displayName(viewingLive)}
          subtitle={staffDisplayRole(viewingLive.role, store.teacherProfiles.find((item) => item.userId === viewingLive.userId)?.specialty)}
          status={viewingLive.status}
          photo={viewingLive.profileImagePath ? api.profileMediaUrl(viewingLive.userId, viewingLive.updatedAt || viewingLive.profileImagePath) : undefined}
          active={viewingLive.status === 'active'}
          onToggleActive={(next) => void setTeacherActive(viewingLive, next)}
          onClose={() => setViewing(null)}
          actions={
            <>
              <Button type="button" variant="ghost" onClick={() => setViewing(null)}>
                Close
              </Button>
              <Link className="hlc-btn hlc-btn-ghost" href={`/admin/staff/${viewingLive.userId}`}>
                Open workspace
              </Link>
              <Link className="hlc-btn hlc-btn-ghost" href={`/admin/staff/${viewingLive.userId}`}>
                Assign task
              </Link>
              <Button
                type="button"
                onClick={() => {
                  setEditing(viewingLive);
                  setCreating(false);
                  setViewing(null);
                }}
              >
                Edit
              </Button>
            </>
          }
        >
          <AdminProfileFact label="Contact">{emptyCell(viewingLive.phone || viewingLive.email)}</AdminProfileFact>
          <AdminProfileFact label="Program">{emptyCell(specialtyLaneLabel(store.teacherProfiles.find((item) => item.userId === viewingLive.userId)?.specialty) || assignedText(viewingLive))}</AdminProfileFact>
          <AdminProfileFact label="Assigned students">
            {assignedCount(
              store.enrollments.filter((item) =>
                store.classes.some((cls) => cls.classId === item.classId && cls.teacherId === viewingLive.userId),
              ).length,
            )}
          </AdminProfileFact>
        </AdminProfileModal>
      ) : null}
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
            <Field
              label="Specialization"
              hint="Playgroup, Pre-kinder, Kinder, Nursery, Grade 1–3, ABA Therapy, or Tutorial Session. That teacher appears in the matching Teachers Management list."
            >
              <ProgramSpecialtySelect
                value={store.teacherProfiles.find((item) => item.userId === current?.userId)?.specialty}
                store={store}
              />
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
