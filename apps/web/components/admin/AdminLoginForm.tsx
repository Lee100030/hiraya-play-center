'use client';

import { useAuth } from '@/components/AuthProvider';
import { loginSchema } from '@hiraya/validation';
import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

export function AdminLoginForm() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ login?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      login: form.get('login'),
      password: form.get('password'),
    });
    if (!parsed.success) {
      const next: { login?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'login' || key === 'password') next[key] = issue.message;
      }
      setFieldErrors(next);
      setError(parsed.error.issues[0]?.message || 'Check your details');
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      await login(parsed.data.login, parsed.data.password, form.get('remember') === 'on');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-stage public-frame">
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <Image src="/images/hiraya-crest.png" alt="HIRAYA Learning Center crest" width={88} height={88} />
        <p className="eyebrow">Staff entrance</p>
        <h1>Admin sign in</h1>
        <p>Use your HIRAYA username or email.</p>
        {error ? (
          <p className="login-alert login-alert-error" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="login-alert login-alert-ok" role="status">
            Signed in.
          </p>
        ) : null}
        <label className={fieldErrors.login ? 'field-invalid' : undefined}>
          Email / Username
          <input
            name="login"
            autoComplete="username"
            required
            aria-invalid={Boolean(fieldErrors.login)}
            className={fieldErrors.login ? 'input-error' : success ? 'input-ok' : undefined}
          />
          {fieldErrors.login ? <span className="field-error">{fieldErrors.login}</span> : null}
        </label>
        <label className={fieldErrors.password ? 'field-invalid' : undefined}>
          Password
          <span className="password-field">
            <input
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              aria-invalid={Boolean(fieldErrors.password)}
              className={fieldErrors.password ? 'input-error' : success ? 'input-ok' : undefined}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((value) => !value)}
              aria-pressed={showPassword}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </span>
          {fieldErrors.password ? <span className="field-error">{fieldErrors.password}</span> : null}
        </label>
        <div className="login-row">
          <label className="remember">
            <input type="checkbox" name="remember" defaultChecked />
            Remember me
          </label>
          <Link href="/activate">Forgot password?</Link>
        </div>
        <button className="login-gradient" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Log In'}
        </button>
      </form>
    </main>
  );
}
