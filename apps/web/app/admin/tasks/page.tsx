'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTable } from '@/components/admin/AdminTable';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, Textarea, emptyCell } from '@hiraya/ui';
import { displayName, formatDate, newId } from '@hiraya/utils';
import type { StaffTask } from '@hiraya/types';
import { FormEvent, useState } from 'react';

export default function AdminTasksPage() {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffTask | null>(null);
  const rows = store.staffTasks || [];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: StaffTask = {
      taskId: newId('tsk'),
      title: String(form.get('title') || '').trim(),
      description: String(form.get('description') || '').trim(),
      priority: String(form.get('priority') || 'normal'),
      dueAt: String(form.get('dueAt') || ''),
      teacherIds: String(form.get('teacherIds') || ''),
      classId: String(form.get('classId') || ''),
      studentId: String(form.get('studentId') || ''),
      status: 'assigned',
      response: '',
      attachmentName: '',
      assignedBy: user?.userId || '',
      completedAt: '',
      completedBy: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await save({ ...store, staffTasks: [...rows, next] });
    setOpen(false);
  }

  async function saveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const status = String(form.get('status') || editing.status);
    await save({
      ...store,
      staffTasks: rows.map((item) =>
        item.taskId === editing.taskId
          ? {
              ...item,
              status,
              response: String(form.get('response') || item.response),
              completedAt: status === 'completed' ? new Date().toISOString() : item.completedAt,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    });
    setEditing(null);
  }

  if (loading) return <Loading />;
  return (
    <>
      <AdminPageHeader
        kicker="Management"
        title="Task management"
        description="Assign a task to a teacher. They complete it on mobile; status returns here."
        actions={
          <button type="button" className="dash-action dash-action-primary" onClick={() => setOpen(true)}>
            + Add Task
          </button>
        }
      />
      {open ? (
        <AdminModal title="Add task" onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={onSubmit}>
          <Field label="Title" required>
            <Input name="title" required />
          </Field>
          <Field label="Description">
            <Textarea name="description" />
          </Field>
          <Field label="Priority">
            <Select name="priority" defaultValue="normal">
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
            </Select>
          </Field>
          <Field label="Due">
            <Input name="dueAt" type="date" />
          </Field>
          <Field label="Teacher" required>
            <Select name="teacherIds" required>
              <option value="">Select</option>
              {store.users
                .filter((item) => item.role === 'teacher')
                .map((item) => (
                  <option key={item.userId} value={item.userId}>
                    {displayName(item)}
                  </option>
                ))}
            </Select>
          </Field>
          <Button type="submit">Assign</Button>
        </form>
        </AdminModal>
      ) : null}
      <AdminTable
        rows={rows}
        rowKey={(row) => row.taskId}
        empty={<EmptyState title="No tasks" hint="Assign a task so it appears on the teacher’s mobile app." />}
        columns={[
          { key: 'title', header: 'Task', sortValue: (row) => row.title, render: (row) => row.title },
          { key: 'due', header: 'Due', sortValue: (row) => row.dueAt, render: (row) => emptyCell(formatDate(row.dueAt)) },
          { key: 'status', header: 'Status', sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <button type="button" className="table-action" onClick={() => setEditing(row)}>
                Update
              </button>
            ),
          },
        ]}
        renderCard={(row) => (
          <article className="admin-stack-card">
            <h3>{row.title}</h3>
            <StatusBadge status={row.status} />
            <button type="button" className="table-action" onClick={() => setEditing(row)}>
              Update
            </button>
          </article>
        )}
      />
      {editing ? (
        <AdminModal title={`Update ${editing.title}`} onClose={() => setEditing(null)}>
        <form className="form-grid" onSubmit={saveStatus}>
          <h3>{editing.title}</h3>
          <Field label="Status">
            <Select name="status" defaultValue={editing.status}>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="submitted">Submitted</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          <Field label="Teacher remarks">
            <Textarea name="response" defaultValue={editing.response} />
          </Field>
          <Button type="submit">Save status</Button>{' '}
          <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </form>
        </AdminModal>
      ) : null}
    </>
  );
}
