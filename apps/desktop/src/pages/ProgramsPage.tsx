import type { HirayaDatabase, LearningProgram } from '@hiraya/types';
import { newId } from '@hiraya/utils';
import { Button, Field, Input, Select, Textarea } from '@hiraya/ui';
import { FormEvent, useState } from 'react';
import { EditorModal, FormSection } from '../components/EditorModal';
import { RecordTable, StatusCell, assigned } from '../components/RecordTable';
import { PAGE_COPY } from '../lib/views';

export function ProgramsPage({
  store,
  saveStore,
}: {
  store: HirayaDatabase;
  saveStore: (next: HirayaDatabase) => Promise<void>;
}) {
  const [editing, setEditing] = useState<LearningProgram | null | 'new'>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = editing && editing !== 'new' ? editing : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const next: LearningProgram = {
      programId: current?.programId || newId('prg'),
      name: String(form.get('name') || '').trim(),
      description: String(form.get('description') || '').trim(),
      status: String(form.get('status') || 'active'),
    };
    setBusy(true);
    setError(null);
    try {
      await saveStore({
        ...store,
        programs: current
          ? store.programs.map((item) => (item.programId === next.programId ? next : item))
          : [...store.programs, next],
      });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save program');
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: LearningProgram) {
    const used = store.classes.some((item) => item.programId === row.programId);
    if (used) {
      if (!window.confirm('This program has classes. Archive it instead of deleting?')) return;
      await saveStore({
        ...store,
        programs: store.programs.map((item) =>
          item.programId === row.programId ? { ...item, status: 'archived' } : item,
        ),
      });
      return;
    }
    if (!window.confirm(`Delete program ${row.name}?`)) return;
    await saveStore({
      ...store,
      programs: store.programs.filter((item) => item.programId !== row.programId),
    });
  }

  return (
    <>
      <RecordTable
        title={PAGE_COPY.programs.title}
        description="Programs feed the public enrollment form, student records, and class assignment."
        rows={store.programs}
        rowKey={(row) => row.programId}
        search={(row, q) => `${row.name} ${row.description}`.toLowerCase().includes(q)}
        searchPlaceholder="Search programs"
        emptyTitle="No programs found"
        emptyHint="Add a program before creating classes or taking enrollments."
        statusOf={(row) => row.status}
        actions={
          <Button type="button" onClick={() => setEditing('new')}>
            Add program
          </Button>
        }
        columns={[
          { key: 'name', header: 'Program', render: (row) => row.name },
          { key: 'desc', header: 'Description', render: (row) => assigned(row.description) },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <div className="row-actions">
                <Button type="button" variant="ghost" onClick={() => setEditing(row)}>
                  Edit
                </Button>
                <Button type="button" variant="danger" onClick={() => void remove(row)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />
      {editing ? (
        <EditorModal
          title={current ? `Edit ${current.name}` : 'Add program'}
          error={error}
          busy={busy}
          submitLabel={current ? 'Save program' : 'Create program'}
          onClose={() => setEditing(null)}
          onSubmit={onSubmit}
        >
          <FormSection title="Program details">
            <Field label="Name" required>
              <Input name="name" defaultValue={current?.name} required />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={current?.status || 'active'}>
                <option value="active">active</option>
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
