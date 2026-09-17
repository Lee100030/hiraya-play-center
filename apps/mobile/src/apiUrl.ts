import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 5188;

function isLoopback(value: string) {
  return /^(https?:\/\/)?(127\.0\.0\.1|localhost|\[::1\])\b/i.test(value);
}

function expoPackagerHost(): string | null {
  const fromExtra = Constants.expoConfig?.extra?.apiHost as string | undefined;
  if (fromExtra) return fromExtra.replace(/\/$/, '');

  const uri =
    Constants.expoConfig?.hostUri ||
    Constants.linkingUri ||
    (Constants as { debuggerHost?: string }).debuggerHost ||
    '';
  const cleaned = String(uri)
    .replace(/^[a-z]+:\/\//i, '')
    .split('/')[0]
    .split('?')[0];
  const host = cleaned.replace(/^\[|\]$/g, '').split(':')[0]?.trim();
  if (!host) return null;
  if (host.includes('exp.direct') || host.includes('ngrok') || host.includes('expo.dev')) return null;
  return host;
}

export function resolveMobileApiUrl(): string {
  const env = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
  let onPhone = true;
  try {
    onPhone = Constants.isDevice === true;
  } catch {
    onPhone = Platform.OS !== 'web';
  }

  if (env && !(onPhone && isLoopback(env))) return env;

  const host = expoPackagerHost();
  if (host && !isLoopback(host)) return `http://${host}:${API_PORT}`;

  if (!onPhone) {
    if (Platform.OS === 'android') return `http://10.0.2.2:${API_PORT}`;
    return `http://127.0.0.1:${API_PORT}`;
  }

  if (env) return env;
  if (Platform.OS === 'android') return `http://10.0.2.2:${API_PORT}`;
  return `http://127.0.0.1:${API_PORT}`;
}
