'use client';

import { useAuth } from '@/components/AuthProvider';
import { Alert } from '@hiraya/ui';
import { loginSchema } from '@hiraya/validation';
import Image from 'next/image';
import { FormEvent, useState } from 'react';

export function AdminLoginForm() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      login: form.get('login'),
      password: form.get('password'),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Check your details');
      return;
    }
    setBusy(true);
    try {
      await login(parsed.data.login, parsed.data.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-stage">
      <form className="login-glass" onSubmit={onSubmit}>
        <Image src="/images/hiraya-crest.png" alt="HIRAYA Learning Center crest" width={80} height={80} />
        <h1>Admin sign in</h1>
        <p>Staff entrance for HIRAYA Learning Center.</p>
        {error ? <Alert>{error}</Alert> : null}
        <label>
          Username
          <input name="login" autoComplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="login-gradient" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </main>
  );
}
