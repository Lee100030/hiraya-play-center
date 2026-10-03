'use client';

import { useStore } from '@/components/StoreProvider';
import { api } from '@/lib/api';
import { Button, Card, Field, Input, Loading, StatusBadge, Textarea } from '@hiraya/ui';
import { FormEvent, useState } from 'react';

export default function WebsiteCmsPage() {
  const { store, loading, refresh, save } = useStore();
  const [message, setMessage] = useState('');

  async function saveLanding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.saveWebsiteLanding(String(form.get('welcomeTitle') || ''), String(form.get('welcomeMessage') || ''));
    await refresh();
    setMessage('Landing saved. The public website reads this from the API.');
  }

  async function saveAbout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api.saveWebsiteAbout({
      aboutTitle: String(form.get('aboutTitle') || ''),
      description: String(form.get('description') || ''),
      mission: String(form.get('mission') || ''),
      vision: String(form.get('vision') || ''),
      values: String(form.get('values') || ''),
    });
    await refresh();
    setMessage('About page saved.');
  }

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await save({
      ...store,
      settings: {
        ...store.settings,
        address: String(form.get('address') || ''),
        phone: String(form.get('phone') || ''),
        email: String(form.get('email') || ''),
        businessHours: String(form.get('businessHours') || ''),
        updatedAt: new Date().toISOString(),
      },
    });
    await refresh();
    setMessage('Center details saved. Reload the public Contact section to confirm.');
  }

  if (loading) return <Loading />;
  const s = store.settings;

  return (
    <>
      <h1>Website CMS</h1>
      {message ? <p>{message}</p> : null}
      <form className="hlc-card form-grid" onSubmit={saveLanding}>
        <h2>Landing</h2>
        <Field label="Welcome title">
          <Input name="welcomeTitle" defaultValue={s.welcomeTitle} />
        </Field>
        <Field label="Welcome message">
          <Textarea name="welcomeMessage" defaultValue={s.welcomeMessage} />
        </Field>
        <Button type="submit">Save landing</Button>
      </form>
      <form className="hlc-card form-grid" onSubmit={saveAbout}>
        <h2>About</h2>
        <Field label="About title">
          <Input name="aboutTitle" defaultValue={s.aboutTitle} />
        </Field>
        <Field label="Description">
          <Textarea name="description" defaultValue={s.description} />
        </Field>
        <Field label="Mission">
          <Textarea name="mission" defaultValue={s.mission} />
        </Field>
        <Field label="Vision">
          <Textarea name="vision" defaultValue={s.vision} />
        </Field>
        <Field label="Values">
          <Textarea name="values" defaultValue={s.values} />
        </Field>
        <Button type="submit">Save about</Button>
      </form>
      <form className="hlc-card form-grid" onSubmit={saveContact}>
        <h2>Center details</h2>
        <Field label="Address">
          <Input name="address" defaultValue={s.address || 'Rodriguez (Montalban), Rizal, Philippines'} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={s.phone || '+63 917 753 4258'} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={s.email || 'hirayakids.learning@gmail.com'} />
        </Field>
        <Field label="Business hours">
          <Input name="businessHours" defaultValue={s.businessHours || 'Monday–Friday, 8:00–17:00'} />
        </Field>
        <Button type="submit">Save contact</Button>
      </form>
      <form
        className="hlc-card form-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const file = form.get('file');
          if (!(file instanceof File) || file.size === 0) {
            setMessage('Choose an MP4 or WEBM video.');
            return;
          }
          await api.saveIntroVideo(file, file.name);
          setMessage('Campus film uploaded. Reload the public About section to play it.');
          event.currentTarget.reset();
        }}
      >
        <h2>Campus film</h2>
        <Field label="About video (MP4 or WEBM, up to 25 MB)">
          <Input name="file" type="file" accept="video/mp4,video/webm" />
        </Field>
        <Button type="submit">Upload film</Button>
      </form>
      <Card title="Gallery">
        {store.websiteGallery.length === 0 ? (
          <p>No gallery items in the API store yet.</p>
        ) : (
          store.websiteGallery.map((item) => (
            <p key={item.itemId}>
              {item.title} <StatusBadge status={item.status} />
            </p>
          ))
        )}
      </Card>
    </>
  );
}
