export const SESSION_HEADER = 'X-Hiraya-Session';
export const SESSION_STORAGE_KEY = 'hiraya.session';

export function resolveApiBaseUrl(explicit?: string): string {
  if (explicit !== undefined && explicit !== null) return explicit.replace(/\/$/, '');
  const fromEnv =
    (typeof process !== 'undefined' &&
      (process.env.NEXT_PUBLIC_API_URL ||
        process.env.EXPO_PUBLIC_API_URL ||
        process.env.VITE_API_URL ||
        process.env.API_URL)) ||
    '';
  return (fromEnv || 'http://127.0.0.1:5188').replace(/\/$/, '');
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
