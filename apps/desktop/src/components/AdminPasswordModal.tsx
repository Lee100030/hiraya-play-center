import { Button, Field, Input } from '@hiraya/ui';
import type { FormEvent } from 'react';
import { DeskModal } from './DeskModal';

export function AdminPasswordModal({
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
    <DeskModal title="Confirm with admin password" stacked hideFooter onClose={onClose}>
      <form className="admin-password-form" onSubmit={onSubmit}>
        <p>Enter your administrator password to save this password change.</p>
        {error ? <p className="form-error">{error}</p> : null}
        <Field label="Admin password" required>
          <Input name="adminPassword" type="password" autoComplete="current-password" required autoFocus />
        </Field>
        <div className="admin-password-actions">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Confirm and save'}
          </Button>
        </div>
      </form>
    </DeskModal>
  );
}
