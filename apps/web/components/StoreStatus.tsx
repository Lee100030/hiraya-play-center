'use client';

import { Alert, Button } from '@hiraya/ui';
import { useStore } from '@/components/StoreProvider';

export function StoreStatus() {
  const { error, refresh, loading } = useStore();
  if (!error) return null;
  return (
    <Alert>
      {error}{' '}
      <Button type="button" variant="ghost" onClick={() => void refresh()} disabled={loading}>
        Retry API
      </Button>
    </Alert>
  );
}
