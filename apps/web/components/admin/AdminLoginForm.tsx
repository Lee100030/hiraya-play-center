'use client';

import { useAuth } from '@/components/AuthProvider';
import { isAdminLoginChallenge } from '@hiraya/api';
import { loginSchema } from '@hiraya/validation';
import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';

export function AdminLoginForm() {
  const { login, completeAdminOtp, resendAdminOtp } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
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
  const digits = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!challenge) return;
    const timer = window.setTimeout(() => digits.current[0]?.focus(), 40);
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeCode();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [challenge]);

  function closeCode() {
    setChallenge(null);
    setCode('');
    setOtpError(null);
  }

  function placeCode(index: number, raw: string) {
    const chars = raw.replace(/\D/g, '');
    if (chars.length > 1) {
      const next = (code.slice(0, index) + chars).replace(/\D/g, '').slice(0, 6);
      setCode(next);
      digits.current[Math.min(next.length, 5)]?.focus();
      return;
    }
    const slots = Array.from({ length: 6 }, (_, i) => code[i] || '');
    slots[index] = chars.slice(-1);
    const next = slots.join('').replace(/\D/g, '').slice(0, 6);
    setCode(next);
    if (chars && index < 5) digits.current[index + 1]?.focus();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
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
    setBusy(true);
    try {
      const result = await login(parsed.data.login, parsed.data.password, remember);
      if (isAdminLoginChallenge(result)) {
        setChallenge(result.challenge);
        setSentTo(result.sentTo);
        setCode('');
        setOtpError(null);
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setOtpError('Enter the 6-digit code from the email.');
      return;
    }
    setOtpError(null);
    setBusy(true);
    try {
      await completeAdminOtp(challenge, trimmed, remember);
      setSuccess(true);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'That sign-in code is not valid.');
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    if (!challenge) return;
    setOtpError(null);
    setBusy(true);
    try {
      const next = await resendAdminOtp(challenge);
      if (isAdminLoginChallenge(next)) {
        setChallenge(next.challenge);
        setSentTo(next.sentTo);
      }
      setCode('');
      digits.current[0]?.focus();
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'The code could not be sent again.');
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
        <div className="login-row">
          <label className="remember">
            <input type="checkbox" name="remember" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            Remember me
          </label>
          <Link href="/activate">Forgot password?</Link>
        </div>
        <button className="login-gradient" type="submit" disabled={busy && !challenge}>
          {busy && !challenge ? 'Signing in…' : 'Log In'}
        </button>
      </form>
      {challenge ? (
        <div className="otp-modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeCode()}>
          <form className="otp-card" role="dialog" aria-modal="true" aria-labelledby="otp-title" onSubmit={onConfirm}>
            <Image src="/images/hiraya-crest.png" alt="" width={72} height={72} />
            <p className="otp-kicker">Super Administrator</p>
            <h2 id="otp-title">Enter your sign-in code</h2>
            <p>We sent a 6-digit code. It expires in 10 minutes.</p>
            <span className="otp-mail">{sentTo}</span>
            {otpError ? (
              <p className="login-alert login-alert-error" role="alert">
                {otpError}
              </p>
            ) : null}
            <div className="otp-digits">
              {Array.from({ length: 6 }, (_, index) => (
                <input
                  key={index}
                  ref={(node) => {
                    digits.current[index] = node;
                  }}
                  className="otp-digit"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Digit ${index + 1}`}
                  maxLength={index === 0 ? 6 : 1}
                  value={code[index] || ''}
                  onChange={(event) => placeCode(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Backspace' && !code[index]) {
                      event.preventDefault();
                      const prev = Math.max(0, index - 1);
                      setCode(code.slice(0, prev) + code.slice(prev + 1));
                      digits.current[prev]?.focus();
                    }
                  }}
                />
              ))}
            </div>
            <div className="otp-actions">
              <button type="button" onClick={() => void onResend()} disabled={busy}>
                Resend code
              </button>
              <button type="button" onClick={closeCode} disabled={busy}>
                Cancel
              </button>
            </div>
            <button className="login-gradient" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Confirm code'}
            </button>
          </form>
        </div>
      ) : null}
    </main>
  );
}
