import { FileSystemSessionType, FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
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
  throw new Error(message);
}

/** Native multipart upload — Expo Go's fetch rejects `{ uri, name, type }` FormData parts. */
export async function uploadProfilePhotoNative(userId: string, uri: string, fileName = 'profile.jpg') {
  const headers = await api.authHeaders();
  const local = fileUri(uri);
  const options = {
    httpMethod: 'POST' as const,
    uploadType: FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: 'image/jpeg',
    parameters: { filename: fileName },
    headers,
    sessionType: FileSystemSessionType.FOREGROUND,
  };

  let result = await uploadAsync(api.endpoint(`/api/users/${encodeURIComponent(userId)}/photo`), local, options);
  if (result.status === 404) {
    result = await uploadAsync(api.endpoint(`/api/staff/${encodeURIComponent(userId)}/photo`), local, options);
  }
  throwIfFailed(result.status, result.body);
  return api.getStore();
}
