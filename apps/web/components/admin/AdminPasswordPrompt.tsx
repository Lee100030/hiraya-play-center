'use client';

import { Button, Field, Input } from '@hiraya/ui';
import type { FormEvent } from 'react';
import { AdminModal } from './AdminModal';

export function AdminPasswordPrompt({
  busy,
  error,
  onClose,
  onConfirm,
}: {
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (adminPassword: string) => void | Promise<void>;
}) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const adminPassword = String(new FormData(event.currentTarget).get('adminPassword') || '');
    void onConfirm(adminPassword);
  }

  return (
    <AdminModal
      title="Confirm with admin password"
      description="Enter your administrator password to save this password change."
      stacked
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="admin-password-form" disabled={busy}>
            {busy ? 'Saving…' : 'Confirm and save'}
          </Button>
        </>
      }
    >
      <form id="admin-password-form" className="form-grid" onSubmit={onSubmit}>
        {error ? <p className="hlc-field-error">{error}</p> : null}
        <Field label="Admin password" required>
          <Input name="adminPassword" type="password" autoComplete="current-password" required autoFocus />
        </Field>
      </form>
    </AdminModal>
  );
}
