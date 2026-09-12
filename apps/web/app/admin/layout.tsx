'use client';

import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { AdminShell } from '@/components/admin/AdminShell';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import { StoreProvider } from '@/components/StoreProvider';
import type { ReactNode } from 'react';

function AdminGate({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="hlc-loading">Opening HIRAYA…</div>;
  if (!user) return <AdminLoginForm />;
  return <AdminShell>{children}</AdminShell>;
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <StoreProvider>
        <AdminGate>{children}</AdminGate>
      </StoreProvider>
    </AuthProvider>
  );
}
