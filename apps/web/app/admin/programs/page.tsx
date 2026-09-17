'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, Textarea } from '@hiraya/ui';
import { newId } from '@hiraya/utils';
import type { LearningProgram } from '@hiraya/types';
import { FormEvent, useState } from 'react';

function programMeta(program: LearningProgram) {
  const text = `${program.name} ${program.description}`;
  const age = text.match(/(\d+\s*[-–to]+\s*\d+\s*(yo|years?|mos?)?)/i)?.[0] || 'Age range on file';
  const duration = text.match(/(\d+\s*[-–]?\s*(month|week|year|day)s?)/i)?.[0] || 'Duration on file';
  return { age, duration };
}

export default function AdminProgramsPage() {
  const { store, loading, save } = useStore();
  const [editing, setEditing] = useState<LearningProgram | 'new' | null>(null);
  const [removing, setRemoving] = useState<LearningProgram | null>(null);
  const current = editing && editing !== 'new' ? editing : null;

  function enrolledCount(name: string) {
    const fromStudents = store.students.filter((item) => (item.program || '').toLowerCase() === name.toLowerCase()).length;
    const fromApps = store.enrollmentApplications.filter(
      (item) => (item.preferredProgram || '').toLowerCase() === name.toLowerCase() && (item.status === 'approved'),
    ).length;
    return Math.max(fromStudents, fromApps);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: LearningProgram = {
      programId: current?.programId || newId('prg'),
      name: String(form.get('name') || ''),
      description: String(form.get('description') || ''),
      status: String(form.get('status') || 'active'),
    };
    await save({
      ...store,
      programs: current
        ? store.programs.map((item) => (item.programId === next.programId ? next : item))
        : [...store.programs, next],
    });
    setEditing(null);
  }

  async function remove() {
    if (!removing) return;
    await save({ ...store, programs: store.programs.filter((item) => item.programId !== removing.programId) });
    setRemoving(null);
  }

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Curriculum"
        title="Programs"
        description="Offerings families see on the public site, with enrollment counts from live records."
        actions={
          <button type="button" className="dash-action dash-action-primary" onClick={() => setEditing('new')}>
            Add Program
          </button>
        }
      />
      {store.programs.length === 0 ? (
        <EmptyState title="No programs yet" hint="Add a program to start enrollments." />
      ) : (
        <div className="admin-program-grid">
          {store.programs.map((row) => {
            const meta = programMeta(row);
            return (
              <article key={row.programId} className="hlc-card admin-program-card">
                <h3>{row.name}</h3>
                <StatusBadge status={row.status} />
                <div className="admin-program-meta">
                  <span>Age range: {meta.age}</span>
                  <span>Duration: {meta.duration}</span>
                  <span>Enrolled students: {enrolledCount(row.name)}</span>
                </div>
                <p>{row.description && row.description !== row.name ? row.description : 'Curriculum details live with this offering.'}</p>
                <div className="icon-actions">
                  <button type="button" className="icon-btn" aria-label={`Edit ${row.name}`} onClick={() => setEditing(row)}>
                    ✎
                  </button>
                  <button type="button" className="icon-btn danger" aria-label={`Delete ${row.name}`} onClick={() => setRemoving(row)}>
                    ⌫
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing ? (
        <AdminModal
          title={current ? 'Edit program' : 'Add program'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" form="program-form">
                Save
              </Button>
            </>
          }
        >
          <form id="program-form" className="form-grid" onSubmit={onSubmit}>
            <Field label="Program name" required>
              <Input name="name" defaultValue={current?.name} required />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={current?.status || 'active'}>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </Select>
            </Field>
            <Field label="Description (include age range and duration)">
              <Textarea name="description" defaultValue={current?.description} />
            </Field>
          </form>
        </AdminModal>
      ) : null}

      {removing ? (
        <AdminModal
          title="Delete program"
          description={`Remove ${removing.name}?`}
          onClose={() => setRemoving(null)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={() => void remove()}>
                Delete
              </Button>
            </>
          }
        >
          <p>Families will no longer see this offering on the public programs page once unpublished from records.</p>
        </AdminModal>
      ) : null}
    </>
  );
}
