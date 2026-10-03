'use client';

import { useEffect, useState } from 'react';
import { Button } from '@hiraya/ui';
import { moduleTuitionLanes, saveProgramTuition } from '@hiraya/utils';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useStore } from '@/components/StoreProvider';

function feeText(value: number | null) {
  return value ? String(value) : '';
}

export default function ProgramTuitionPage() {
  const { store, save } = useStore();
  const rows = moduleTuitionLanes(store);
  const draftKey = rows.map((row) => `${row.id}:${feeText(row.tuitionFee)}`).join('|');
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((row) => [row.id, feeText(row.tuitionFee)])));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDrafts(Object.fromEntries(rows.map((row) => [row.id, feeText(row.tuitionFee)])));
  }, [draftKey]);

  const saved = Object.fromEntries(rows.map((row) => [row.id, feeText(row.tuitionFee)]));
  const dirtyIds = rows.filter((row) => (drafts[row.id] ?? '') !== (saved[row.id] ?? '')).map((row) => row.id);
  const dirty = dirtyIds.length > 0;

  async function saveAll() {
    if (!dirty) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const next = dirtyIds.reduce((current, id) => saveProgramTuition(current, id, drafts[id] ?? ''), store);
      await save(next);
      setMessage(dirtyIds.length === 1 ? 'Tuition fee saved.' : `Saved tuition fees for ${dirtyIds.length} programs.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save tuition fees.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <AdminPageHeader
        kicker="Management"
        title="Program tuition management"
        description="Set the tuition fee for each program. A student's remaining balance is that fee minus every payment already counted."
        actions={
          <Button type="button" onClick={() => void saveAll()} disabled={!dirty || busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        }
      />
      {message ? <p className="form-ok tuition-banner" role="status">{message}</p> : null}
      {error ? <p className="form-error tuition-banner" role="alert">{error}</p> : null}
      <div className="panel program-tuition">
        <table className="tuition-table">
          <thead>
            <tr>
              <th scope="col">Program</th>
              <th scope="col">Tuition fee</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                <td>
                  <label className="peso-field">
                    <span aria-hidden="true">₱</span>
                    <input
                      aria-label={`${row.label} tuition fee`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Not set"
                      value={drafts[row.id] ?? ''}
                      disabled={busy}
                      onChange={(event) => {
                        setMessage('');
                        setError('');
                        setDrafts((current) => ({ ...current, [row.id]: event.target.value }));
                      }}
                    />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tuition-note">{dirty ? 'Unsaved fee changes.' : 'Fees match what is saved.'}</p>
      </div>
    </section>
  );
}
