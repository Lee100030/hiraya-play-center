import { SESSION_STORAGE_KEY } from '@hiraya/config';
import type { AuthSession, HirayaUser } from '@hiraya/types';

const USER_KEY = 'hiraya.user';

function stores(): Storage[] {
  if (typeof window === 'undefined') return [];
  return [localStorage, sessionStorage];
}

export function readSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  for (const storage of stores()) {
    const token = storage.getItem(SESSION_STORAGE_KEY);
    const raw = storage.getItem(USER_KEY);
    if (!token || !raw) continue;
    try {
      return { token, user: JSON.parse(raw) as HirayaUser };
    } catch {
      storage.removeItem(SESSION_STORAGE_KEY);
      storage.removeItem(USER_KEY);
    }
  }
  return null;
}

export function writeSession(session: AuthSession | null, persist = true): void {
  if (typeof window === 'undefined') return;
  for (const storage of stores()) {
    storage.removeItem(SESSION_STORAGE_KEY);
    storage.removeItem(USER_KEY);
  }
  if (!session) return;
  const storage = persist ? localStorage : sessionStorage;
  storage.setItem(SESSION_STORAGE_KEY, session.token);
  storage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function sessionPersists(): boolean {
  if (typeof window === 'undefined') return true;
  return Boolean(localStorage.getItem(SESSION_STORAGE_KEY));
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_STORAGE_KEY) || sessionStorage.getItem(SESSION_STORAGE_KEY);
}
