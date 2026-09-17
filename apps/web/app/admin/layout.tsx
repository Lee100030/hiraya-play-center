'use client';

import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { AdminShell } from '@/components/admin/AdminShell';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import { StoreProvider } from '@/components/StoreProvider';
import { homeHref } from '@/lib/nav';
import { isAdmin, roleLabel } from '@hiraya/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';

function AdminGate({ children }: { children: ReactNode }) {
  const { user, ready, logout } = useAuth();
  if (!ready) return <div className="hlc-loading">Opening HIRAYA…</div>;
  if (!user) return <AdminLoginForm />;
  if (!isAdmin(user.role)) {
    return (
      <div className="hlc-card" style={{ maxWidth: 480, margin: '48px auto' }}>
        <h1>Operations is Super Admin only</h1>
        <p>
          Signed in as {roleLabel(user.role)}. Teachers and parents use the mobile app. This browser console is for the Super
          Administrator.
        </p>
        <p>
          <Link href={homeHref(user.role)}>Go to your home</Link>
        </p>
        <button type="button" className="dash-action" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
    );
  }
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
