'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, Table, emptyCell } from '@hiraya/ui';
import { formatDateTime, newId } from '@hiraya/utils';
import type { Schedule } from '@hiraya/types';
import { FormEvent, useState } from 'react';

export default function SchedulesPage() {
  const { store, loading, save } = useStore();
  const [editing, setEditing] = useState<Schedule | null | 'new'>(null);
  const current = editing && editing !== 'new' ? editing : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: Schedule = {
      scheduleId: current?.scheduleId || newId('sch'),
      title: String(form.get('title') || ''),
      kind: String(form.get('kind') || 'class'),
      classId: String(form.get('classId') || ''),
      studentId: current?.studentId || '',
      teacherId: String(form.get('teacherId') || ''),
      scheduleType: String(form.get('kind') || 'class'),
      startAt: String(form.get('startAt') || ''),
      endAt: String(form.get('endAt') || ''),
      room: String(form.get('room') || ''),
      notes: String(form.get('notes') || ''),
      status: String(form.get('status') || 'scheduled'),
    };
    await save({
      ...store,
      schedules: current
        ? store.schedules.map((item) => (item.scheduleId === next.scheduleId ? next : item))
        : [...store.schedules, next],
    });
    setEditing(null);
  }

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Management"
        title="Schedule management"
        description="Class times and events. Teachers see assigned sessions on mobile."
        actions={
          <button type="button" className="dash-action dash-action-primary" onClick={() => setEditing('new')}>
            + Add Schedule
          </button>
        }
      />
      {editing ? (
        <form className="hlc-card form-grid" onSubmit={onSubmit}>
          <Field label="Title" required>
            <Input name="title" defaultValue={current?.title} required />
          </Field>
          <Field label="Kind">
            <Select name="kind" defaultValue={current?.kind || 'class'}>
              <option value="class">class</option>
              <option value="event">event</option>
            </Select>
          </Field>
          <Field label="Class">
            <Select name="classId" defaultValue={current?.classId || ''}>
              <option value="">None</option>
              {store.classes.map((item) => (
                <option key={item.classId} value={item.classId}>
                  {item.name}
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
                    {user.fullname}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Starts">
            <Input name="startAt" type="datetime-local" defaultValue={current?.startAt?.slice(0, 16)} />
          </Field>
          <Field label="Ends">
            <Input name="endAt" type="datetime-local" defaultValue={current?.endAt?.slice(0, 16)} />
          </Field>
          <Field label="Room">
            <Input name="room" defaultValue={current?.room} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={current?.status || 'scheduled'}>
              <option value="scheduled">scheduled</option>
              <option value="cancelled">cancelled</option>
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
      {store.schedules.length === 0 ? (
        <EmptyState title="No schedules" />
      ) : (
        <div className="admin-table-wrap">
        <Table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Kind</th>
              <th>Start</th>
              <th>End</th>
              <th>Room</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {store.schedules.map((row) => (
              <tr key={row.scheduleId}>
                <td>{row.title}</td>
                <td>{row.kind}</td>
                <td>{formatDateTime(row.startAt) || emptyCell('')}</td>
                <td>{formatDateTime(row.endAt) || emptyCell('')}</td>
                <td>{emptyCell(row.room)}</td>
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
        </div>
      )}
    </>
  );
}
