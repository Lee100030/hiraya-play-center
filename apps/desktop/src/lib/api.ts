import { createHirayaApi } from '@hiraya/api';
import { resolveApiBaseUrl, SESSION_STORAGE_KEY } from '@hiraya/config';

export const USER_STORAGE_KEY = 'hiraya.user';

export const api = createHirayaApi(
  {
    getToken: () => localStorage.getItem(SESSION_STORAGE_KEY),
    setToken: (token) => {
      if (token) localStorage.setItem(SESSION_STORAGE_KEY, token);
      else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    },
  },
  resolveApiBaseUrl(import.meta.env.VITE_API_URL) || 'http://127.0.0.1:5188',
);
