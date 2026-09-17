'use client';

import { createHirayaApi } from '@hiraya/api';
import { getToken, writeSession } from './session';

export const api = createHirayaApi(
  {
    getToken,
    setToken: (token) => {
      if (!token) writeSession(null);
    },
  },
  '',
);
