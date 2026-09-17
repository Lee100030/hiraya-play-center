export const SESSION_HEADER = 'X-Hiraya-Session';
export const SESSION_STORAGE_KEY = 'hiraya.session';
export const CENTRAL_API_PORT = 5188;
export const CENTRAL_API_DEFAULT = `http://127.0.0.1:${CENTRAL_API_PORT}`;

function envApiUrl(): string {
  if (typeof process === 'undefined') return '';
  return (
    process.env.HIRAYA_API_URL ||
    process.env.HIRAYA_API_INTERNAL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.VITE_API_URL ||
    process.env.API_URL ||
    ''
  );
}

export function resolveApiBaseUrl(explicit?: string): string {
  const trimmed = (explicit || '').trim().replace(/\/$/, '');
  const fromEnv = envApiUrl().replace(/\/$/, '');
  const raw = trimmed || fromEnv;
  const base = raw.replace(/\/api$/i, '');
  if (base) return base;
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    if (protocol === 'file:' || !host) return CENTRAL_API_DEFAULT;
    if (host === 'localhost' || host === '127.0.0.1') return CENTRAL_API_DEFAULT;
  }
  const hosted =
    typeof process !== 'undefined' && (process.env.VERCEL || process.env.NODE_ENV === 'production');
  if (hosted) return '';
  return CENTRAL_API_DEFAULT;
}

export const brand = {
  name: 'HIRAYA Learning Center',
  shortName: 'HIRAYA',
  green: '#0B3D2E',
  greenDeep: '#041009',
  gold: '#D4AF37',
  goldLight: '#e8c547',
  cream: '#f7f1e1',
  danger: '#c44536',
};
