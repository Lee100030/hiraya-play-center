export const SESSION_HEADER = 'X-Hiraya-Session';
export const SESSION_STORAGE_KEY = 'hiraya.session';

export function resolveApiBaseUrl(explicit?: string): string {
  if (explicit) return explicit.replace(/\/$/, '');
  const fromEnv =
    (typeof process !== 'undefined' &&
      (process.env.NEXT_PUBLIC_API_URL ||
        process.env.EXPO_PUBLIC_API_URL ||
        process.env.VITE_API_URL ||
        process.env.API_URL)) ||
    '';
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const hosted =
    (typeof process !== 'undefined' && (process.env.VERCEL || process.env.NODE_ENV === 'production')) ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1');
  if (hosted) return '';
  return 'http://127.0.0.1:5188';
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
