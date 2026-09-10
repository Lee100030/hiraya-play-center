'use client';

import { AuthProvider, useAuth } from '@/components/AuthProvider';
import { homeHref } from '@/lib/nav';
import { Alert } from '@hiraya/ui';
import { loginSchema } from '@hiraya/validation';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

function AdminLoginForm() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace(homeHref(user.role));
  }, [ready, user, router]);

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
      const session = await login(parsed.data.login, parsed.data.password);
      router.replace(homeHref(session.user.role));
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
        <h1>Sign in</h1>
        <p>Staff, teachers, and families use this private entrance.</p>
        {error ? <Alert>{error}</Alert> : null}
        <label>
          Username or email
          <input name="login" autoComplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="login-gradient" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Continue'}
        </button>
        <p>
          <Link href="/activate">Activate an invited account</Link>
        </p>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <AuthProvider>
      <AdminLoginForm />
    </AuthProvider>
  );
}
