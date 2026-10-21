import { Alert } from '@hiraya/ui';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Icons } from '../icons';

export function LoginScreen({
  login,
  password,
  error,
  busy,
  onLogin,
  onPassword,
  onSubmit,
  otpSentTo,
  otpCode,
  onOtpCode,
  onResendOtp,
  onClearOtp,
}: {
  login: string;
  password: string;
  error: string | null;
  busy: boolean;
  onLogin: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  otpSentTo?: string | null;
  otpCode?: string;
  onOtpCode?: (value: string) => void;
  onResendOtp?: () => void;
  onClearOtp?: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showRecover, setShowRecover] = useState(false);
  const digits = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!otpSentTo) return;
    const timer = window.setTimeout(() => digits.current[0]?.focus(), 40);
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClearOtp?.();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [otpSentTo, onClearOtp]);

  function placeCode(index: number, raw: string) {
    const current = otpCode || '';
    const chars = raw.replace(/\D/g, '');
    if (chars.length > 1) {
      const next = (current.slice(0, index) + chars).replace(/\D/g, '').slice(0, 6);
      onOtpCode?.(next);
      digits.current[Math.min(next.length, 5)]?.focus();
      return;
    }
    const slots = Array.from({ length: 6 }, (_, i) => current[i] || '');
    slots[index] = chars.slice(-1);
    const next = slots.join('').replace(/\D/g, '').slice(0, 6);
    onOtpCode?.(next);
    if (chars && index < 5) digits.current[index + 1]?.focus();
  }

  return (
    <div className="login-stage">
      <div className="login-glow" aria-hidden="true" />
      <div className="login-particles" aria-hidden="true" />
      <img className="login-watermark" src="./images/hiraya-crest.png" alt="" />
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <header className="login-brand">
          <img src="./images/hiraya-crest.png" alt="" width={84} height={84} />
          <p className="login-kicker">Center director workspace</p>
          <h1>HIRAYA Desktop</h1>
          <p className="login-lead">Super Administrator, teachers, and parents sign in here. Children use a parent account.</p>
        </header>
        {error && !otpSentTo ? <Alert>{error}</Alert> : null}
        <label className="login-field">
          <span>
            Username
            <abbr title="Required">*</abbr>
          </span>
          <input
            className="login-input"
            value={login}
            autoComplete="username"
            autoFocus
            required
            onChange={(event) => onLogin(event.target.value)}
          />
        </label>
        <label className="login-field">
          <span>
            Password
            <abbr title="Required">*</abbr>
          </span>
          <span className="login-password">
            <input
              className="login-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              required
              onChange={(event) => onPassword(event.target.value)}
            />
            <button
              type="button"
              className="login-eye"
              onClick={() => setShowPassword((value) => !value)}
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <Icons.eyeOff /> : <Icons.eye />}
              <span className="login-eye-label">{showPassword ? 'Hide' : 'Show'}</span>
            </button>
          </span>
        </label>
        <button className="login-submit" type="submit" disabled={busy && !otpSentTo}>
          {busy && !otpSentTo ? 'Signing in…' : 'Open workspace'}
        </button>
        {busy && !import.meta.env.DEV ? (
          <p className="login-hint" role="status">
            The first sign-in after a quiet period can take up to a minute while the center wakes up.
          </p>
        ) : null}
        {import.meta.env.DEV &&
        (!import.meta.env.VITE_API_URL || /localhost|127\.0\.0\.1/.test(String(import.meta.env.VITE_API_URL))) ? (
          <p className="login-hint">
            <Icons.shield width={16} height={16} />
            <span>Local demo sign-in is on this screen only. Keep Hiraya.Api on port 5188.</span>
          </p>
        ) : null}
        <button type="button" className="login-recover" onClick={() => setShowRecover((value) => !value)}>
          Forgot password? Contact IT support
        </button>
        {showRecover ? (
          <p className="login-recover-copy" role="status">
            Ask a center administrator to reset your staff password from Staff records. Activation links from the website also work for first-time accounts.
          </p>
        ) : null}
      </form>
      {otpSentTo ? (
        <div className="otp-modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClearOtp?.()}>
          <form className="otp-card" role="dialog" aria-modal="true" aria-labelledby="otp-title" onSubmit={onSubmit}>
            <img src="./images/hiraya-crest.png" alt="" width={72} height={72} />
            <p className="otp-kicker">Super Administrator</p>
            <h2 id="otp-title">Enter your sign-in code</h2>
            <p>We sent a 6-digit code. It expires in 10 minutes.</p>
            <span className="otp-mail">{otpSentTo}</span>
            {error ? <Alert>{error}</Alert> : null}
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
                  value={(otpCode || '')[index] || ''}
                  onChange={(event) => placeCode(index, event.target.value)}
                  onKeyDown={(event) => {
                    const current = otpCode || '';
                    if (event.key === 'Backspace' && !current[index]) {
                      event.preventDefault();
                      const prev = Math.max(0, index - 1);
                      onOtpCode?.(current.slice(0, prev) + current.slice(prev + 1));
                      digits.current[prev]?.focus();
                    }
                  }}
                />
              ))}
            </div>
            <div className="otp-actions">
              <button type="button" className="login-recover" onClick={onResendOtp} disabled={busy}>
                Resend code
              </button>
              <button type="button" className="login-recover" onClick={onClearOtp} disabled={busy}>
                Cancel
              </button>
            </div>
            <button className="login-submit" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Confirm code'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
