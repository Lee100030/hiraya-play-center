import { Platform } from 'react-native';
import { SESSION_HEADER } from '@hiraya/config';
import { api } from './auth';

function fileUri(uri: string) {
  if (Platform.OS === 'android' && uri.startsWith('content:')) return uri;
  if (uri.startsWith('file:')) return uri;
  return `file://${uri}`;
}

function throwIfFailed(status: number, body: string) {
  if (status >= 200 && status < 300) return;
  let message = `Could not save the photo (${status}).`;
  try {
    const data = JSON.parse(body) as { error?: string; message?: string };
    message = data.error || data.message || message;
  } catch {
    if (body.trim()) message = body.trim().slice(0, 180);
  }
  if (status === 401) {
    message = 'Your sign-in was not accepted for this photo. Sign out, sign in again, then retry.';
  }
  throw new Error(message);
}

function postPhoto(url: string, uri: string, fileName: string, session: string) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const body = new FormData();
    body.append('file', {
      uri: fileUri(uri),
      name: fileName,
      type: 'image/jpeg',
    } as unknown as Blob);
    if (session) body.append('session', session);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.timeout = 60000;
    if (session) xhr.setRequestHeader(SESSION_HEADER, session);
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText || '' });
    xhr.onerror = () => reject(new Error('Could not reach the center. Check your connection and try again.'));
    xhr.ontimeout = () => reject(new Error('The photo upload timed out. Try a smaller photo.'));
    xhr.send(body);
  });
}

/** Multipart upload that keeps the session. Expo's file uploader drops custom headers on iOS. */
export async function uploadProfilePhotoNative(userId: string, uri: string, fileName = 'profile.jpg') {
  const headers = await api.authHeaders();
  const session = headers[SESSION_HEADER] || '';
  const usersUrl = api.endpoint(`/api/users/${encodeURIComponent(userId)}/photo`);
  let result = await postPhoto(usersUrl, uri, fileName, session);
  if (result.status === 404) {
    result = await postPhoto(api.endpoint(`/api/staff/${encodeURIComponent(userId)}/photo`), uri, fileName, session);
  }
  throwIfFailed(result.status, result.body);
  return api.getStore();
}
