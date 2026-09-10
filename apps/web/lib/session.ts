import { SESSION_STORAGE_KEY } from '@hiraya/config';
import type { AuthSession, HirayaUser } from '@hiraya/types';

const USER_KEY = 'hiraya.user';

export function readSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(SESSION_STORAGE_KEY);
  const raw = localStorage.getItem(USER_KEY);
  if (!token || !raw) return null;
  try {
    return { token, user: JSON.parse(raw) as HirayaUser };
  } catch {
    return null;
  }
}

export function writeSession(session: AuthSession | null): void {
  if (typeof window === 'undefined') return;
  if (!session) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
    return;
  }
  localStorage.setItem(SESSION_STORAGE_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_STORAGE_KEY);
}
