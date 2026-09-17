'use client';

import { useStore } from '@/components/StoreProvider';
import { Button, Card, Field, Input, Loading } from '@hiraya/ui';
import { FormEvent } from 'react';

export default function SettingsPage() {
  const { store, loading, save } = useStore();
  const s = store.settings;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await save({
      ...store,
      settings: {
        ...s,
        centerName: String(form.get('centerName') || s.centerName),
        address: String(form.get('address') || ''),
        phone: String(form.get('phone') || ''),
        email: String(form.get('email') || ''),
        businessHours: String(form.get('businessHours') || ''),
        timeZone: String(form.get('timeZone') || s.timeZone),
        updatedAt: new Date().toISOString(),
      },
    });
  }

  if (loading) return <Loading />;

  return (
    <>
      <h1>System settings</h1>
      <form className="hlc-card form-grid" onSubmit={onSubmit}>
        <Field label="Center name">
          <Input name="centerName" defaultValue={s.centerName} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={s.phone} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={s.email} />
        </Field>
        <Field label="Address">
          <Input name="address" defaultValue={s.address} />
        </Field>
        <Field label="Business hours">
          <Input name="businessHours" defaultValue={s.businessHours} />
        </Field>
        <Field label="Time zone">
          <Input name="timeZone" defaultValue={s.timeZone} />
        </Field>
        <div>
          <Button type="submit">Save settings</Button>
        </div>
      </form>
      <Card title="Saved identity">
        <p>{s.centerName}</p>
        <p>{s.address}</p>
      </Card>
    </>
  );
}
