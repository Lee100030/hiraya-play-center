'use client';

import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Button, Card, EmptyValue, Field, Input, Loading } from '@hiraya/ui';
import { api } from '@/lib/api';
import { FormEvent, useState } from 'react';

export default function ProfilePage() {
  const { user } = useAuth();
  const { store, loading } = useStore();
  const [message, setMessage] = useState<string | null>(null);
  if (loading) return <Loading />;
  const live = store.users.find((u) => u.userId === user?.userId) ?? user;

  async function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    try {
      await api.changePassword(
        user.userId,
        String(form.get('currentPassword') || ''),
        String(form.get('newPassword') || ''),
      );
      setMessage('Password updated');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not update password');
    }
  }

  return (
    <>
      <h1>Profile</h1>
      <Card title={live?.fullname || 'Account'}>
        <p>{live?.email || <EmptyValue />}</p>
        <p>{live?.role || <EmptyValue />}</p>
        <p>{live?.phone || <EmptyValue />}</p>
        <p>{live?.address || <EmptyValue />}</p>
      </Card>
      <form className="hlc-card" style={{ marginTop: 16, maxWidth: 420 }} onSubmit={onPassword}>
        <h2>Change password</h2>
        {message ? <p>{message}</p> : null}
        <Field label="Current password">
          <Input name="currentPassword" type="password" required />
        </Field>
        <div style={{ height: 12 }} />
        <Field label="New password">
          <Input name="newPassword" type="password" minLength={8} required />
        </Field>
        <div style={{ marginTop: 12 }}>
          <Button type="submit">Save password</Button>
        </div>
      </form>
    </>
  );
}
