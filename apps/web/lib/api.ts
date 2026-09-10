'use client';

import { createHirayaApi } from '@hiraya/api';
import { resolveApiBaseUrl } from '@hiraya/config';
import { getToken, writeSession } from './session';

export const api = createHirayaApi(
  {
    getToken,
    setToken: (token) => {
      if (!token) writeSession(null);
    },
  },
  resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL),
);
