import type { HirayaDatabase, HirayaUser, LearningModule } from '@hiraya/types';
import { Button, Field, Input, ProgramSpecialtySelect, Select, Textarea } from '@hiraya/ui';
import { laneLabel, moduleInLane, type ManagementLaneId } from '@hiraya/utils';
import { FormEvent, useState } from 'react';
import { EditorModal, FormSection } from '../components/EditorModal';
import { RecordTable, StatusCell, assigned } from '../components/RecordTable';
import { api } from '../lib/api';
import { PAGE_COPY } from '../lib/views';

const MODULE_FILE_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif';

function formatSize(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ModulesPage({
  store,
  user,
  onStore,
  onRefresh,
  lane,
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  onStore: (next: HirayaDatabase) => void;
  onRefresh?: () => Promise<void> | void;
  lane?: ManagementLaneId | null;
}) {
  const canManage = user.role === 'super_admin';
  const [editing, setEditing] = useState<LearningModule | null | 'new'>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = editing && editing !== 'new' ? editing : null;
  const rows = store.learningModules.filter((row) => moduleInLane(store, row, lane));

  async function openFile(row: LearningModule) {
    if (!row.fileName && !row.filePath) {
      setError('No file is stored on that module yet.');
      return;
    }
    setError(null);
    try {
      await api.openModuleFile(row.moduleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that file.');
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
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
    setError(null);
    try {
      onStore(
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
        ),
      );
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save module');
    } finally {
      setBusy(false);
    }
  }

  async function archiveRows(picked: LearningModule[]) {
    if (!picked.length) return false;
    let next = store;
    for (const row of picked) {
      next = await api.setModuleStatus(row.moduleId, row.status === 'archived' ? 'draft' : 'archived');
    }
    onStore(next);
  }

  return (
    <>
      {error && !editing ? <p className="hlc-field-error">{error}</p> : null}
      <RecordTable
        title={lane ? `Module management · ${laneLabel(lane)}` : PAGE_COPY.modules.title}
        description={
          lane
            ? `Learning files for ${laneLabel(lane)}.`
            : canManage
              ? 'Upload lesson guides and worksheets, store the file on this module, then open it again anytime.'
              : 'Open published modules for your classes and programs.'
        }
        rows={rows}
        rowKey={(row) => row.moduleId}
        search={(row, q) => `${row.title} ${row.subject} ${row.moduleType} ${row.fileName}`.toLowerCase().includes(q)}
        searchPlaceholder="Filter this list of modules"
        emptyTitle="No learning modules"
        emptyHint={canManage ? 'Add a module and upload a file to share with teachers.' : 'No published modules yet.'}
        statusOf={(row) => row.status}
        crud={{
          addLabel: canManage ? '+ Add Module' : undefined,
          onAdd: canManage ? () => setEditing('new') : undefined,
          onEdit: canManage ? (row) => setEditing(row) : undefined,
          onArchive: canManage ? archiveRows : undefined,
          onRefresh,
          singleActions: [
            {
              label: 'Open file',
              icon: 'file',
              needOneMessage: 'Select one module to open its file.',
              onClick: (row) => void openFile(row),
            },
          ],
        }}
        columns={[
          { key: 'title', header: 'Module', render: (row) => row.title },
          { key: 'subject', header: 'Subject', render: (row) => assigned(row.subject) },
          {
            key: 'program',
            header: 'Program',
            render: (row) => assigned(store.programs.find((item) => item.programId === row.programId)?.name),
          },
          { key: 'type', header: 'Type', priority: 'secondary', render: (row) => assigned(row.moduleType) },
          {
            key: 'file',
            header: 'File',
            render: (row) =>
              row.fileName ? (
                <button type="button" className="linkish" onClick={() => void openFile(row)}>
                  {row.fileName}
                  {row.fileSize ? ` · ${formatSize(row.fileSize)}` : ''}
                </button>
              ) : (
                assigned('')
              ),
          },
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
            <Field
              label="Program lane"
              optional
              hint="Used for Module management filters (Playgroup, Pre-kinder, Grade 1–3, ABA, Tutorial)."
            >
              <ProgramSpecialtySelect name="specialty" value={current?.gradeLevel || lane || ''} store={store} />
            </Field>
            <Field
              label="Module file"
              required={!current}
              optional={Boolean(current)}
              hint="PDF, Word, PowerPoint, Excel, or image. Max 25 MB. Stored on this module so you can open it later."
            >
              <Input name="file" type="file" accept={MODULE_FILE_ACCEPT} required={!current} />
              {current?.fileName ? (
                <p className="hlc-field-hint">
                  Stored now: {current.fileName}
                  {current.fileSize ? ` (${formatSize(current.fileSize)})` : ''}. Choose a file only to replace it.{' '}
                  <Button type="button" variant="ghost" onClick={() => void openFile(current)}>
                    Open stored file
                  </Button>
                </p>
              ) : null}
            </Field>
            {current?.fileName ? (
              <Field label="Change note" optional>
                <Input name="changeDescription" placeholder="Why this file was replaced" />
              </Field>
            ) : null}
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
