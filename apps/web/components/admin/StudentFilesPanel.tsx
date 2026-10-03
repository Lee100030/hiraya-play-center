'use client';

import type { HirayaDatabase, StudentDocument } from '@hiraya/types';
import { STUDENT_FILE_KINDS, studentFileKindLabel } from '@hiraya/utils';
import { Button, EmptyValue } from '@hiraya/ui';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StudentFilesPanel({
  studentId,
  store,
  onStore,
  canEdit = true,
}: {
  studentId: string;
  store: HirayaDatabase;
  onStore?: (next: HirayaDatabase) => void;
  canEdit?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState('birth_certificate');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const files = (store.studentDocuments || [])
    .filter((item) => item.studentId === studentId)
    .slice()
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  async function onPick(list: FileList | null) {
    const file = list?.[0];
    if (!file || !canEdit) return;
    setBusy(true);
    setError(null);
    try {
      onStore?.(await api.uploadStudentFile(studentId, file, file.name, kind));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not store that file.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function remove(row: StudentDocument) {
    if (!canEdit) return;
    if (!window.confirm(`Remove ${row.title || row.originalName}?`)) return;
    setBusy(true);
    setError(null);
    try {
      onStore?.(await api.deleteStudentFile(studentId, row.documentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="student-files">
      <header className="student-files-head">
        <div>
          <h3>Student files</h3>
          <p>Birth certificate, medical records, and other documents for this learner.</p>
        </div>
      </header>
      {canEdit ? (
        <div className="student-files-upload">
          <label>
            <span>File type</span>
            <select className="hlc-select" value={kind} onChange={(event) => setKind(event.target.value)} disabled={busy}>
              {STUDENT_FILE_KINDS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            hidden
            onChange={(event) => void onPick(event.target.files)}
          />
          <Button type="button" variant="ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? 'Saving…' : 'Add file'}
          </Button>
        </div>
      ) : null}
      {error ? <p className="student-files-error">{error}</p> : null}
      {files.length === 0 ? (
        <EmptyValue label="No files stored yet" />
      ) : (
        <ul className="student-files-list">
          {files.map((row) => (
            <li key={row.documentId}>
              <div>
                <strong>{row.title || row.originalName}</strong>
                <span>
                  {studentFileKindLabel(row.kind)} · {formatSize(row.sizeBytes || 0)}
                </span>
              </div>
              <div className="student-files-actions">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void api.openStudentFile(row.documentId, row.createdAt).catch((err) =>
                      setError(err instanceof Error ? err.message : 'Could not open that file.'),
                    )
                  }
                >
                  Open
                </Button>
                {canEdit ? (
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => void remove(row)}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
