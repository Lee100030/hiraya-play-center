'use client';

import { AuthProvider } from '@/components/AuthProvider';
import { StoreProvider } from '@/components/StoreProvider';
import { AppShell } from '@/components/AppShell';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StoreProvider>
        <AppShell>{children}</AppShell>
      </StoreProvider>
    </AuthProvider>
  );
}
