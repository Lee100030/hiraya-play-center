'use client';

import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, Table } from '@hiraya/ui';
import { displayName, newId } from '@hiraya/utils';
import type { LearningClass } from '@hiraya/types';
import { FormEvent, useState } from 'react';

export default function ClassesPage() {
  const { store, loading, save } = useStore();
  const [editing, setEditing] = useState<LearningClass | null | 'new'>(null);
  const current = editing && editing !== 'new' ? editing : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: LearningClass = {
      classId: current?.classId || newId('cls'),
      name: String(form.get('name') || ''),
      programId: String(form.get('programId') || ''),
      teacherId: String(form.get('teacherId') || ''),
      room: String(form.get('room') || ''),
      capacity: Number(form.get('capacity') || 0),
      scheduleNotes: String(form.get('scheduleNotes') || ''),
      status: String(form.get('status') || 'active'),
    };
    await save({
      ...store,
      classes: current
        ? store.classes.map((item) => (item.classId === next.classId ? next : item))
        : [...store.classes, next],
    });
    setEditing(null);
  }

  async function remove(row: LearningClass) {
    const used = store.enrollments.some((item) => item.classId === row.classId && item.status === 'active');
    if (used) {
      if (!window.confirm('This class has enrollments. Archive it instead of deleting?')) return;
      await save({
        ...store,
        classes: store.classes.map((item) =>
          item.classId === row.classId ? { ...item, status: 'archived' } : item,
        ),
      });
      return;
    }
    if (!window.confirm(`Delete class ${row.name}?`)) return;
    await save({
      ...store,
      classes: store.classes.filter((item) => item.classId !== row.classId),
    });
  }

  if (loading) return <Loading />;

  return (
    <>
      <div className="toolbar">
        <h1>Classes</h1>
        <Button type="button" onClick={() => setEditing('new')}>
          Add class
        </Button>
      </div>
      {editing ? (
        <form className="hlc-card form-grid" onSubmit={onSubmit}>
          <Field label="Name" required>
            <Input name="name" defaultValue={current?.name} required />
          </Field>
          <Field label="Program">
            <Select name="programId" defaultValue={current?.programId || ''}>
              <option value="">Select</option>
              {store.programs.map((program) => (
                <option key={program.programId} value={program.programId}>
                  {program.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Teacher">
            <Select name="teacherId" defaultValue={current?.teacherId || ''}>
              <option value="">Unassigned</option>
              {store.users
                .filter((user) => user.role === 'teacher' || user.role === 'staff')
                .map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {displayName(user)}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Room">
            <Input name="room" defaultValue={current?.room} />
          </Field>
          <Field label="Capacity">
            <Input name="capacity" type="number" defaultValue={current?.capacity ?? 15} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={current?.status || 'active'}>
              <option value="active">active</option>
              <option value="archived">archived</option>
            </Select>
          </Field>
          <div>
            <Button type="submit">Save</Button>{' '}
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {store.classes.length === 0 ? (
        <EmptyState title="No classes" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Class</th>
              <th>Program</th>
              <th>Teacher</th>
              <th>Capacity</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {store.classes.map((row) => (
              <tr key={row.classId}>
                <td>{row.name}</td>
                <td>{store.programs.find((p) => p.programId === row.programId)?.name}</td>
                <td>{displayName(store.users.find((u) => u.userId === row.teacherId))}</td>
                <td>{row.capacity}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  <Button type="button" variant="ghost" onClick={() => setEditing(row)}>
                    Edit
                  </Button>{' '}
                  <Button type="button" variant="ghost" onClick={() => void remove(row)}>
                    Delete
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
