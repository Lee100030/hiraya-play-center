import { Alert } from '@hiraya/ui';
import { FormEvent, useState } from 'react';
import { Icons } from '../icons';

export function LoginScreen({
  login,
  password,
  error,
  busy,
  onLogin,
  onPassword,
  onSubmit,
}: {
  login: string;
  password: string;
  error: string | null;
  busy: boolean;
  onLogin: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showRecover, setShowRecover] = useState(false);

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
        {error ? <Alert>{error}</Alert> : null}
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
        <button className="login-submit" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Open workspace'}
        </button>
        {busy && !import.meta.env.DEV ? (
          <p className="login-hint" role="status">
            The first sign-in after a quiet period can take up to a minute while the center wakes up.
          </p>
        ) : null}
        {import.meta.env.DEV ? (
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
    </div>
  );
}
