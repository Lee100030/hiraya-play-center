import type { HirayaDatabase, HirayaUser, LearningModule } from '@hiraya/types';
import { newId } from '@hiraya/utils';
import { Field, Input, Select, Textarea } from '@hiraya/ui';
import { FormEvent, useState } from 'react';
import { EditorModal, FormSection } from '../components/EditorModal';
import { RecordTable, StatusCell, assigned } from '../components/RecordTable';
import { PAGE_COPY } from '../lib/views';

export function ModulesPage({
  store,
  user,
  saveStore,
  onRefresh,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
}) {
  const canManage = user.role === 'super_admin';
  const [editing, setEditing] = useState<LearningModule | null | 'new'>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = editing && editing !== 'new' ? editing : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
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
      uploadedByUserId: current?.uploadedByUserId || user.userId,
      createdAt: current?.createdAt || now,
      updatedAt: now,
      publishedAt: status === 'published' ? current?.publishedAt || now : current?.publishedAt || '',
      archivedAt: status === 'archived' ? now : '',
    };
    if (!next.title) {
      setError('Title is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveStore({
        ...store,
        learningModules: current
          ? store.learningModules.map((item) => (item.moduleId === next.moduleId ? next : item))
          : [...store.learningModules, next],
      });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save module');
    } finally {
      setBusy(false);
    }
  }

  async function archiveRows(picked: LearningModule[]) {
    if (!picked.length) return false;
    const now = new Date().toISOString();
    const ids = new Set(picked.map((row) => row.moduleId));
    await saveStore({
      ...store,
      learningModules: store.learningModules.map((item) =>
        ids.has(item.moduleId)
          ? { ...item, status: item.status === 'archived' ? 'draft' : 'archived', archivedAt: item.status === 'archived' ? '' : now, updatedAt: now }
          : item,
      ),
    });
  }

  return (
    <>
      <RecordTable
        title={PAGE_COPY.modules.title}
        description={
          canManage
            ? 'Add lesson guides and worksheets, assign a program, and publish or archive them for teachers.'
            : 'Modules published for your classes and programs.'
        }
        rows={store.learningModules}
        rowKey={(row) => row.moduleId}
        search={(row, q) => `${row.title} ${row.subject} ${row.moduleType} ${row.fileName}`.toLowerCase().includes(q)}
        searchPlaceholder="Filter this list of modules"
        emptyTitle="No learning modules"
        emptyHint={canManage ? 'Add a module to share with teachers.' : 'No published modules yet.'}
        statusOf={(row) => row.status}
        crud={
          canManage
            ? {
                addLabel: '+ Add Module',
                onAdd: () => setEditing('new'),
                onEdit: (row) => setEditing(row),
                onArchive: archiveRows,
                onRefresh,
              }
            : { onRefresh }
        }
        columns={[
          { key: 'title', header: 'Module', render: (row) => row.title },
          { key: 'subject', header: 'Subject', render: (row) => assigned(row.subject) },
          {
            key: 'program',
            header: 'Program',
            render: (row) => assigned(store.programs.find((item) => item.programId === row.programId)?.name),
          },
          { key: 'type', header: 'Type', priority: 'secondary', render: (row) => assigned(row.moduleType) },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
        ]}
      />
      {editing && canManage ? (
        <EditorModal
          title={current ? `Edit ${current.title}` : 'Add module'}
          error={error}
          busy={busy}
          submitLabel={current ? 'Save module' : 'Create module'}
          onClose={() => setEditing(null)}
          onSubmit={onSubmit}
        >
          <FormSection title="Module details">
            <Field label="Title" required>
              <Input name="title" defaultValue={current?.title} required />
            </Field>
            <Field label="Subject" optional>
              <Input name="subject" defaultValue={current?.subject} />
            </Field>
            <Field label="Program" optional>
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
            <Field label="Grade / level" optional>
              <Input name="gradeLevel" defaultValue={current?.gradeLevel} />
            </Field>
            <Field label="File name" optional>
              <Input name="fileName" defaultValue={current?.fileName} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={current?.status || 'draft'}>
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </Select>
            </Field>
            <div className="form-span">
              <Field label="Description" optional>
                <Textarea name="description" defaultValue={current?.description} />
              </Field>
            </div>
          </FormSection>
        </EditorModal>
      ) : null}
    </>
  );
}
