'use client';

import { api } from '@/lib/api';
import { publicDefaults, withPublicFallback } from '@/lib/publicSite';
import type { PublicSite } from '@hiraya/types';
import { useEffect, useState } from 'react';

export function usePublicSite() {
  const [site, setSite] = useState<PublicSite>(publicDefaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getPublicSite()
      .then((data) => setSite(withPublicFallback(data)))
      .catch(() => setSite(publicDefaults))
      .finally(() => setLoading(false));
  }, []);

  return { site, loading };
}
