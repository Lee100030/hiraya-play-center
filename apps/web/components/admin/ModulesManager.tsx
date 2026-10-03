'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTable } from '@/components/admin/AdminTable';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { api } from '@/lib/api';
import { Button, EmptyState, Field, Input, Loading, ProgramSpecialtySelect, Select, StatusBadge, Textarea, emptyCell } from '@hiraya/ui';
import { isAdmin, laneLabel, moduleInLane, parsePeopleLane } from '@hiraya/utils';
import type { LearningModule } from '@hiraya/types';
import { FormEvent, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const MODULE_FILE_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif';

function formatSize(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ModulesManager() {
  const { store, loading, refresh } = useStore();
  const { user } = useAuth();
  const canManage = isAdmin(user?.role);
  const searchParams = useSearchParams();
  const lane = parsePeopleLane(searchParams.get('lane'), store);
  const [editing, setEditing] = useState<LearningModule | 'new' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const current = editing && editing !== 'new' ? editing : null;
  const rows = store.learningModules.filter((row) => moduleInLane(store, row, lane));

  async function openFile(row: LearningModule) {
    if (!row.fileName && !row.filePath) {
      setError('No file is stored on that module yet.');
      return;
    }
    setError('');
    try {
      await api.openModuleFile(row.moduleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that file.');
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    const file = (form.get('file') as File | null) || null;
    const hasFile = Boolean(file && file.size);
    if (!title) {
      setError('Title is required.');
      return;
    }
    if (!current && !hasFile) {
      setError('Upload a module file.');
      return;
    }
    const status = String(form.get('status') || 'draft');
    setBusy(true);
    setError('');
    try {
      await api.saveModule(
        {
          moduleId: current?.moduleId,
          title,
          description: String(form.get('description') || ''),
          programId: String(form.get('programId') || ''),
          subject: String(form.get('subject') || ''),
          gradeLevel: String(form.get('specialty') || form.get('gradeLevel') || ''),
          moduleType: String(form.get('moduleType') || 'Lesson guide'),
          changeDescription: String(form.get('changeDescription') || ''),
          status,
          publish: status === 'published',
        },
        hasFile ? file : null,
      );
      await refresh();
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save module');
    } finally {
      setBusy(false);
    }
  }

  async function archive(row: LearningModule) {
    setError('');
    try {
      await api.setModuleStatus(row.moduleId, row.status === 'archived' ? 'draft' : 'archived');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that module.');
    }
  }

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Management"
        title={lane ? `Module management · ${laneLabel(lane)}` : 'Module management'}
        description={
          lane
            ? `Learning files for ${laneLabel(lane)}.`
            : canManage
              ? 'Upload lesson guides and worksheets, store the file on this module, then open it again anytime.'
              : 'Open published modules for your classes and programs.'
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
        rows={rows}
        rowKey={(row) => row.moduleId}
        empty={<EmptyState title="No learning modules" hint={canManage ? 'Add a module and upload a file to share with teachers.' : 'No published modules yet.'} />}
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
          {
            key: 'file',
            header: 'File',
            sortValue: (row) => row.fileName,
            render: (row) =>
              row.fileName ? (
                <button type="button" className="linkish" onClick={() => void openFile(row)}>
                  {row.fileName}
                  {row.fileSize ? ` · ${formatSize(row.fileSize)}` : ''}
                </button>
              ) : (
                emptyCell('')
              ),
          },
          { key: 'status', header: 'Status', sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="icon-actions">
                <button type="button" className="icon-btn" aria-label={`Open file for ${row.title}`} onClick={() => void openFile(row)}>
                  ↗
                </button>
                {canManage ? (
                  <>
                    <button type="button" className="icon-btn" aria-label={`Edit ${row.title}`} onClick={() => setEditing(row)}>
                      ✎
                    </button>
                    <button type="button" className="icon-btn" aria-label={row.status === 'archived' ? 'Restore' : 'Archive'} onClick={() => void archive(row)}>
                      {row.status === 'archived' ? '↺' : '▣'}
                    </button>
                  </>
                ) : null}
              </div>
            ),
          },
        ]}
        renderCard={(row) => (
          <article className="admin-stack-card">
            <h3>{row.title}</h3>
            <p>{row.fileName || row.moduleType || 'Module'}</p>
            <StatusBadge status={row.status} />
            <div className="icon-actions">
              <button type="button" className="icon-btn" onClick={() => void openFile(row)}>
                Open file
              </button>
              {canManage ? (
                <>
                  <button type="button" className="icon-btn" onClick={() => setEditing(row)}>
                    ✎
                  </button>
                  <button type="button" className="icon-btn" onClick={() => void archive(row)}>
                    {row.status === 'archived' ? 'Restore' : 'Archive'}
                  </button>
                </>
              ) : null}
            </div>
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
              <Button type="submit" form="module-form" disabled={busy}>
                {busy ? 'Saving…' : current ? 'Save module' : 'Create module'}
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
            <Field label="Program lane" hint="Used for Module management filters (Playgroup, Pre-kinder, Grade 1–3, ABA, Tutorial).">
              <ProgramSpecialtySelect name="specialty" value={current?.gradeLevel || lane || ''} store={store} />
            </Field>
            <Field
              label="Module file"
              required={!current}
              hint="PDF, Word, PowerPoint, Excel, or image. Max 25 MB. Stored on this module so you can open it later."
            >
              <Input name="file" type="file" accept={MODULE_FILE_ACCEPT} required={!current} />
              {current?.fileName ? (
                <p className="hlc-field-hint">
                  Stored now: {current.fileName}
                  {current.fileSize ? ` (${formatSize(current.fileSize)})` : ''}. Choose a file only to replace it.
                </p>
              ) : null}
            </Field>
            {current?.fileName ? (
              <Field label="Change note">
                <Input name="changeDescription" placeholder="Why this file was replaced" />
              </Field>
            ) : null}
            {current?.fileName ? (
              <Button type="button" variant="ghost" onClick={() => void openFile(current)}>
                Open stored file
              </Button>
            ) : null}
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
