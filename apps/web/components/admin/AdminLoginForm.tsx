'use client';

import { useAuth } from '@/components/AuthProvider';
import { isAdminLoginChallenge } from '@hiraya/api';
import { loginSchema } from '@hiraya/validation';
import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

export function AdminLoginForm() {
  const { login, completeAdminOtp, resendAdminOtp } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ login?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loginValue, setLoginValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [remember, setRemember] = useState(true);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setBusy(true);
    try {
      if (challenge) {
        const trimmed = code.trim();
        if (!/^\d{6}$/.test(trimmed)) {
          setError('Enter the 6-digit code from the email.');
          return;
        }
        await completeAdminOtp(challenge, trimmed, remember);
        setSuccess(true);
        return;
      }
      const parsed = loginSchema.safeParse({ login: loginValue, password: passwordValue });
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
      const result = await login(parsed.data.login, parsed.data.password, remember);
      if (isAdminLoginChallenge(result)) {
        setChallenge(result.challenge);
        setSentTo(result.sentTo);
        setCode('');
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (!challenge) return;
    setError(null);
    setBusy(true);
    try {
      const next = await resendAdminOtp(challenge);
      if (isAdminLoginChallenge(next)) {
        setChallenge(next.challenge);
        setSentTo(next.sentTo);
      }
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The code could not be sent again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-stage public-frame">
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <Image src="/images/hiraya-crest.png" alt="Hiraya Kids Learning Center crest" width={88} height={88} />
        <p className="eyebrow">Staff entrance</p>
        <h1>Admin sign in</h1>
        <p>{challenge ? `Enter the 6-digit code sent to ${sentTo}.` : 'Use your HIRAYA username or email.'}</p>
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
        {challenge ? (
          <label>
            Sign-in code
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              required
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </label>
        ) : (
          <>
            <label className={fieldErrors.login ? 'field-invalid' : undefined}>
              Email / Username
              <input
                name="login"
                autoComplete="username"
                required
                value={loginValue}
                aria-invalid={Boolean(fieldErrors.login)}
                className={fieldErrors.login ? 'input-error' : success ? 'input-ok' : undefined}
                onChange={(event) => setLoginValue(event.target.value)}
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
                  value={passwordValue}
                  aria-invalid={Boolean(fieldErrors.password)}
                  className={fieldErrors.password ? 'input-error' : success ? 'input-ok' : undefined}
                  onChange={(event) => setPasswordValue(event.target.value)}
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
          </>
        )}
        <div className="login-row">
          {challenge ? (
            <button type="button" onClick={() => void onResend()} disabled={busy}>
              Resend code
            </button>
          ) : (
            <label className="remember">
              <input type="checkbox" name="remember" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              Remember me
            </label>
          )}
          {challenge ? (
            <button
              type="button"
              onClick={() => {
                setChallenge(null);
                setCode('');
                setError(null);
              }}
            >
              Use password again
            </button>
          ) : (
            <Link href="/activate">Forgot password?</Link>
          )}
        </div>
        <button className="login-gradient" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : challenge ? 'Confirm code' : 'Log In'}
        </button>
      </form>
    </main>
  );
}
