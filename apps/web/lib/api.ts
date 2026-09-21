'use client';

import { createHirayaApi } from '@hiraya/api';
import { getToken, writeSession } from './session';

const webApiBase = process.env.NEXT_PUBLIC_API_URL || '';

export const api = createHirayaApi(
  {
    getToken,
    setToken: (token) => {
      if (!token) writeSession(null);
    },
  },
  webApiBase,
);
