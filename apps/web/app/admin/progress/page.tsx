'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, Textarea } from '@hiraya/ui';
import { displayName, newId, studentDisplay } from '@hiraya/utils';
import type { ProgressReport } from '@hiraya/types';
import { FormEvent, useState } from 'react';

export default function AdminProgressPage() {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  const [editing, setEditing] = useState<ProgressReport | 'new' | null>(null);
  const current = editing && editing !== 'new' ? editing : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    const next: ProgressReport = {
      reportId: current?.reportId || newId('prgnote'),
      studentId: String(form.get('studentId') || ''),
      teacherId: String(form.get('teacherId') || user?.userId || ''),
      classId: String(form.get('classId') || ''),
      period: String(form.get('period') || ''),
      area: String(form.get('area') || ''),
      rating: String(form.get('rating') || ''),
      evaluation: String(form.get('evaluation') || ''),
      behaviorReport: '',
      developmentalReport: '',
      remarks: String(form.get('remarks') || ''),
      uploadedMedia: '',
      status: String(form.get('status') || 'published'),
      createdAt: current?.createdAt || now,
      updatedAt: now,
      history: current?.history || [],
    };
    await save({
      ...store,
      reports: current
        ? store.reports.map((item) => (item.reportId === next.reportId ? next : item))
        : [next, ...store.reports],
    });
    setEditing(null);
  }

  if (loading) return <Loading />;
  return (
    <>
      <AdminPageHeader
        kicker="Records"
        title="Student progress"
        description="Parents only see published progress for linked children."
        actions={
          <button type="button" className="dash-action dash-action-primary" onClick={() => setEditing('new')}>
            + Add progress
          </button>
        }
      />
      {store.reports.length === 0 ? (
        <EmptyState title="No progress records" />
      ) : (
        store.reports.map((row) => (
          <article key={row.reportId} className="hlc-card">
            <h3>{store.students.find((s) => s.studentId === row.studentId) ? studentDisplay(store.students.find((s) => s.studentId === row.studentId)!) : row.studentId}</h3>
            <StatusBadge status={row.status} />
            <p>
              {row.area} · {row.rating}
            </p>
            <p>{row.remarks || row.evaluation}</p>
            <button type="button" className="dash-action" onClick={() => setEditing(row)}>
              Edit
            </button>
          </article>
        ))
      )}
      {editing ? (
        <form className="hlc-card form-grid" onSubmit={onSubmit}>
          <Field label="Student" required>
            <Select name="studentId" defaultValue={current?.studentId || ''} required>
              <option value="">Select</option>
              {store.students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {studentDisplay(s)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Teacher">
            <Select name="teacherId" defaultValue={current?.teacherId || ''}>
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
          <Field label="Area">
            <Input name="area" defaultValue={current?.area} />
          </Field>
          <Field label="Rating">
            <Input name="rating" defaultValue={current?.rating} />
          </Field>
          <Field label="Period">
            <Input name="period" defaultValue={current?.period} />
          </Field>
          <Field label="Remarks">
            <Textarea name="evaluation" defaultValue={current?.evaluation} />
          </Field>
          <Field label="Admin remarks">
            <Textarea name="remarks" defaultValue={current?.remarks} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={current?.status || 'published'}>
              <option value="published">published</option>
              <option value="draft">draft</option>
            </Select>
          </Field>
          <Button type="submit">Save</Button>{' '}
          <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </form>
      ) : null}
    </>
  );
}
