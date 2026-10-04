import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 5188;

function isLoopback(value: string) {
  return /^(https?:\/\/)?(127\.0\.0\.1|localhost|\[::1\])\b/i.test(value);
}

/** Android emulator alias for the computer. A real phone cannot use it. */
function isEmulatorAlias(host: string) {
  return host === '10.0.2.2' || host === '10.0.3.2';
}

function isPrivateLanHost(host: string) {
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
}

function hostFromUrl(value: string) {
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname;
  } catch {
    return value.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
  }
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

/**
 * Prefer Metro's live LAN host over a stale EXPO_PUBLIC_API_URL so Wi-Fi IP
 * changes (common on home routers) do not strand the phone on an old address.
 * Explicit hosted URLs (https / non-LAN) still win.
 */
export function resolveMobileApiUrl(): string {
  const env = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
  let onPhone = true;
  try {
    onPhone = Constants.isDevice === true;
  } catch {
    onPhone = Platform.OS !== 'web';
  }

  const packager = expoPackagerHost();
  const packagerApi = packager && !isLoopback(packager) ? `http://${packager}:${API_PORT}` : null;

  if (env) {
    const envHost = hostFromUrl(env);
    const envIsLoopback = isLoopback(env);
    const envIsLan = isPrivateLanHost(envHost);
    const envIsHttps = /^https:\/\//i.test(env);

    if (onPhone && (envIsLoopback || isEmulatorAlias(envHost))) {
      /* fall through — a phone cannot use this computer's loopback or the emulator alias */
    } else if (envIsHttps || !envIsLan) {
      return env;
    } else if (packagerApi && hostFromUrl(packagerApi) !== envHost) {
      return packagerApi;
    } else {
      return env;
    }
  }

  if (packagerApi) return packagerApi;

  if (!onPhone && Platform.OS === 'android') return `http://10.0.2.2:${API_PORT}`;
  if (!onPhone) return `http://127.0.0.1:${API_PORT}`;

  return `http://127.0.0.1:${API_PORT}`;
}
