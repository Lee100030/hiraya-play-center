'use client';

import { PublicChrome } from '@/components/public/PublicChrome';
import { api } from '@/lib/api';
import { Alert, Button, Field, Input } from '@hiraya/ui';
import { activateSchema } from '@hiraya/validation';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function ActivatePage() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = activateSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Check the form');
      return;
    }
    try {
      await api.activate(parsed.data.token, parsed.data.password);
      setOk(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
    }
  }

  return (
    <PublicChrome>
      <h1>Activate account</h1>
      {ok ? (
        <Alert kind="success">
          Password saved. You can now <Link href="/admin">continue</Link>.
        </Alert>
      ) : (
        <form className="enroll-form" onSubmit={onSubmit}>
          {error ? <Alert>{error}</Alert> : null}
          <Field label="Invitation token">
            <Input name="token" required />
          </Field>
          <Field label="New password">
            <Input name="password" type="password" required minLength={8} />
          </Field>
          <Field label="Confirm password">
            <Input name="confirmPassword" type="password" required minLength={8} />
          </Field>
          <Button type="submit">Activate</Button>
        </form>
      )}
    </PublicChrome>
  );
}
