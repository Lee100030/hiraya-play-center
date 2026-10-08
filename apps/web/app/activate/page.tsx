'use client';

import { PublicChrome } from '@/components/public/PublicChrome';
import { api } from '@/lib/api';
import { Alert, Button, Field, Input } from '@hiraya/ui';
import { activateSchema } from '@hiraya/validation';
import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function ActivateForm() {
  const params = useSearchParams();
  const tokenFromLink = (params.get('token') || '').trim();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const hasLinkToken = tokenFromLink.length >= 8;
  const defaults = useMemo(() => ({ token: tokenFromLink }), [tokenFromLink]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (hasLinkToken && !form.get('token')) form.set('token', tokenFromLink);
    const parsed = activateSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Check the form');
      return;
    }
    try {
      await api.activate(parsed.data.token, parsed.data.password, parsed.data.confirmPassword);
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
          Password saved. Sign in on the HIRAYA phone app with this parent email and the password you just set.
        </Alert>
      ) : (
        <form className="enroll-form" onSubmit={onSubmit}>
          {error ? <Alert>{error}</Alert> : null}
          {hasLinkToken ? (
            <input type="hidden" name="token" value={defaults.token} />
          ) : (
            <Field label="Invitation token">
              <Input name="token" required defaultValue={defaults.token} />
            </Field>
          )}
          <Field label="New password">
            <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password">
            <Input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Button type="submit">Activate</Button>
        </form>
      )}
    </PublicChrome>
  );
}

export default function ActivatePage() {
  return (
    <Suspense>
      <ActivateForm />
    </Suspense>
  );
}
