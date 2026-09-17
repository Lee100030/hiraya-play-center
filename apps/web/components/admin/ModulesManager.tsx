'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTable } from '@/components/admin/AdminTable';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, Textarea, emptyCell } from '@hiraya/ui';
import { isAdmin, newId } from '@hiraya/utils';
import type { LearningModule } from '@hiraya/types';
import { FormEvent, useState } from 'react';

export function ModulesManager() {
  const { store, loading, save } = useStore();
  const { user } = useAuth();
  const canManage = isAdmin(user?.role);
  const [editing, setEditing] = useState<LearningModule | 'new' | null>(null);
  const [error, setError] = useState('');
  const current = editing && editing !== 'new' ? editing : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    const status = String(form.get('status') || 'draft');
    const next: LearningModule = {
      moduleId: current?.moduleId || newId('mod'),
      title: String(form.get('title') || '').trim(),
      description: String(form.get('description') || '').trim(),
      programId: String(form.get('programId') || ''),
      subject: String(form.get('subject') || '').trim(),
      gradeLevel: String(form.get('gradeLevel') || '').trim(),
      moduleType: String(form.get('moduleType') || 'Lesson guide'),
      classIds: current?.classIds || [],
      currentVersionId: current?.currentVersionId || '',
      version: current?.version || 'v1.0',
      status,
      fileName: String(form.get('fileName') || current?.fileName || ''),
      filePath: current?.filePath || '',
      fileType: current?.fileType || '',
      fileSize: current?.fileSize || 0,
      uploadedByUserId: current?.uploadedByUserId || user?.userId || '',
      createdAt: current?.createdAt || now,
      updatedAt: now,
      publishedAt: status === 'published' ? current?.publishedAt || now : current?.publishedAt || '',
      archivedAt: status === 'archived' ? now : '',
    };
    if (!next.title) {
      setError('Title is required.');
      return;
    }
    setError('');
    await save({
      ...store,
      learningModules: current
        ? store.learningModules.map((item) => (item.moduleId === next.moduleId ? next : item))
        : [...store.learningModules, next],
    });
    setEditing(null);
  }

  async function archive(row: LearningModule) {
    const nextStatus = row.status === 'archived' ? 'draft' : 'archived';
    await save({
      ...store,
      learningModules: store.learningModules.map((item) =>
        item.moduleId === row.moduleId
          ? {
              ...item,
              status: nextStatus,
              archivedAt: nextStatus === 'archived' ? new Date().toISOString() : '',
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    });
  }

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Management"
        title="Module management"
        description={
          canManage
            ? 'Create, publish, and archive lesson guides and worksheets for programs and classes.'
            : 'Modules published for your classes and programs.'
        }
        actions={
          canManage ? (
            <button type="button" className="dash-action dash-action-primary" onClick={() => setEditing('new')}>
              + Add Module
            </button>
          ) : undefined
        }
      />
      {error ? <p className="hlc-field-error">{error}</p> : null}
      <AdminTable
        rows={store.learningModules}
        rowKey={(row) => row.moduleId}
        empty={<EmptyState title="No learning modules" hint={canManage ? 'Add a module to share with teachers.' : 'No published modules yet.'} />}
        columns={[
          { key: 'title', header: 'Module', sortValue: (row) => row.title, render: (row) => row.title },
          { key: 'subject', header: 'Subject', sortValue: (row) => row.subject, render: (row) => emptyCell(row.subject) },
          {
            key: 'program',
            header: 'Program',
            sortValue: (row) => store.programs.find((item) => item.programId === row.programId)?.name || '',
            render: (row) => emptyCell(store.programs.find((item) => item.programId === row.programId)?.name),
          },
          { key: 'type', header: 'Type', sortValue: (row) => row.moduleType, render: (row) => emptyCell(row.moduleType), priority: 'secondary' },
          { key: 'status', header: 'Status', sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) =>
              canManage ? (
                <div className="icon-actions">
                  <button type="button" className="icon-btn" aria-label={`Edit ${row.title}`} onClick={() => setEditing(row)}>
                    ✎
                  </button>
                  <button type="button" className="icon-btn" aria-label={row.status === 'archived' ? 'Restore' : 'Archive'} onClick={() => void archive(row)}>
                    {row.status === 'archived' ? '↺' : '▣'}
                  </button>
                </div>
              ) : (
                'Not assigned'
              ),
          },
        ]}
        renderCard={(row) => (
          <article className="admin-stack-card">
            <h3>{row.title}</h3>
            <p>{row.moduleType || 'Module'}</p>
            <StatusBadge status={row.status} />
            {canManage ? (
              <div className="icon-actions">
                <button type="button" className="icon-btn" onClick={() => setEditing(row)}>
                  ✎
                </button>
                <button type="button" className="icon-btn" onClick={() => void archive(row)}>
                  {row.status === 'archived' ? 'Restore' : 'Archive'}
                </button>
              </div>
            ) : null}
          </article>
        )}
      />

      {editing && canManage ? (
        <AdminModal
          title={current ? `Edit ${current.title}` : 'Add module'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" form="module-form">
                {current ? 'Save module' : 'Create module'}
              </Button>
            </>
          }
        >
          <form id="module-form" className="form-grid" onSubmit={onSubmit}>
            <Field label="Title" required>
              <Input name="title" defaultValue={current?.title} required />
            </Field>
            <Field label="Subject">
              <Input name="subject" defaultValue={current?.subject} />
            </Field>
            <Field label="Program">
              <Select name="programId" defaultValue={current?.programId || ''}>
                <option value="">All programs</option>
                {store.programs.map((program) => (
                  <option key={program.programId} value={program.programId}>
                    {program.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type">
              <Select name="moduleType" defaultValue={current?.moduleType || 'Lesson guide'}>
                <option>Lesson guide</option>
                <option>Worksheet</option>
                <option>Presentation</option>
                <option>Assessment</option>
                <option>Handout</option>
                <option>Activity pack</option>
                <option>Other</option>
              </Select>
            </Field>
            <Field label="Grade / level">
              <Input name="gradeLevel" defaultValue={current?.gradeLevel} />
            </Field>
            <Field label="File name">
              <Input name="fileName" defaultValue={current?.fileName} placeholder="optional" />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={current?.status || 'draft'}>
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </Select>
            </Field>
            <Field label="Description">
              <Textarea name="description" defaultValue={current?.description} />
            </Field>
          </form>
        </AdminModal>
      ) : null}
    </>
  );
}
