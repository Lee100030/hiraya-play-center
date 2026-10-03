'use client';

import { api } from '@/lib/api';
import { publicDefaults, withPublicFallback } from '@/lib/publicSite';
import type { PublicSite } from '@hiraya/types';
import { useEffect, useState } from 'react';

export function usePublicSite() {
  const [site, setSite] = useState<PublicSite>(publicDefaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    async function load() {
      try {
        const data = await api.getPublicSite();
        if (!cancel) setSite(withPublicFallback(data));
      } catch {
        if (!cancel) setSite(publicDefaults);
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    void load();
    const onFocus = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancel = true;
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  return { site, loading };
}
