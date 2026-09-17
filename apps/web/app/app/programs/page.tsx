'use client';

import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, Table, Textarea } from '@hiraya/ui';
import { newId } from '@hiraya/utils';
import type { LearningProgram } from '@hiraya/types';
import { FormEvent, useState } from 'react';

export default function ProgramsAdminPage() {
  const { store, loading, save } = useStore();
  const [editing, setEditing] = useState<LearningProgram | null | 'new'>(null);
  const current = editing && editing !== 'new' ? editing : null;

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

  if (loading) return <Loading />;

  return (
    <>
      <div className="toolbar">
        <h1>Programs</h1>
        <Button type="button" onClick={() => setEditing('new')}>
          Add program
        </Button>
      </div>
      {editing ? (
        <form className="hlc-card form-grid" onSubmit={onSubmit}>
          <Field label="Name" required>
            <Input name="name" defaultValue={current?.name} required />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={current?.status || 'active'}>
              <option value="active">active</option>
              <option value="archived">archived</option>
            </Select>
          </Field>
          <Field label="Description">
            <Textarea name="description" defaultValue={current?.description} />
          </Field>
          <div>
            <Button type="submit">Save</Button>{' '}
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {store.programs.length === 0 ? (
        <EmptyState title="No programs yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {store.programs.map((row) => (
              <tr key={row.programId}>
                <td>{row.name}</td>
                <td>{row.description}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  <Button type="button" variant="ghost" onClick={() => setEditing(row)}>
                    Edit
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
