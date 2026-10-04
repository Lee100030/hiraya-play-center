'use client';

import { useStore } from '@/components/StoreProvider';
import { api } from '@/lib/api';
import { Button, Card, Field, Input, Loading, StatusBadge, Textarea } from '@hiraya/ui';
import { FormEvent, useState } from 'react';

const DEFAULT_HEADLINE = 'Growing minds.\nBuilding futures.';

function headlineForEditor(welcomeTitle?: string) {
  const title = (welcomeTitle || '').trim();
  if (!title || /^welcome to\b/i.test(title)) return DEFAULT_HEADLINE;
  return title;
}

export default function WebsiteCmsPage() {
  const { store, loading, refresh } = useStore();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const programs = store.programs.filter((program) => program.status === 'active');
    setBusy(true);
    setMessage('');
    try {
      await api.publishWebsite({
        centerName: String(form.get('centerName') || ''),
        welcomeTitle: String(form.get('welcomeTitle') || ''),
        welcomeMessage: String(form.get('welcomeMessage') || ''),
        aboutTitle: String(form.get('aboutTitle') || ''),
        description: String(form.get('description') || ''),
        mission: String(form.get('mission') || ''),
        vision: String(form.get('vision') || ''),
        values: String(form.get('values') || ''),
        address: String(form.get('address') || ''),
        phone: String(form.get('phone') || ''),
        email: String(form.get('email') || ''),
        website: String(form.get('website') || ''),
        businessHours: String(form.get('businessHours') || ''),
        programs: programs.map((program) => ({
          programId: program.programId,
          name: String(form.get(`programName:${program.programId}`) || ''),
          description: String(form.get(`programDescription:${program.programId}`) || ''),
        })),
      });
      await refresh();
      setMessage('Published. Refresh the public website to see it. The live site reads this from the center.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not publish the website.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  const s = store.settings;
  const programs = store.programs.filter((program) => program.status === 'active');

  return (
    <>
      <h1>Website CMS</h1>
      {message ? <p>{message}</p> : null}
      <form key={s.updatedAt} className="hlc-card form-grid" onSubmit={publish}>
        <h2>Home</h2>
        <Field label="Center name">
          <Input name="centerName" defaultValue={s.centerName} />
        </Field>
        <Field label="Home headline" hint="One line, or two lines. This is the large title on the home page.">
          <Textarea name="welcomeTitle" rows={2} defaultValue={headlineForEditor(s.welcomeTitle)} />
        </Field>
        <Field label="Home introduction">
          <Textarea name="welcomeMessage" defaultValue={s.welcomeMessage} />
        </Field>
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
        <h2>Contact</h2>
        <Field label="Address">
          <Input name="address" defaultValue={s.address} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={s.phone} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={s.email} />
        </Field>
        <Field label="Website or Facebook link">
          <Input name="website" defaultValue={s.website} />
        </Field>
        <Field label="Business hours">
          <Input name="businessHours" defaultValue={s.businessHours} />
        </Field>
        <h2>Programs</h2>
        <p>Name and description shown on the website. Tuition and session counts stay on the program record.</p>
        {programs.map((program) => (
          <div key={program.programId}>
            <Field label="Program name">
              <Input name={`programName:${program.programId}`} defaultValue={program.name} />
            </Field>
            <Field label="Public description">
              <Textarea name={`programDescription:${program.programId}`} defaultValue={program.description} />
            </Field>
          </div>
        ))}
        <Button type="submit" disabled={busy}>
          {busy ? 'Publishing…' : 'Publish'}
        </Button>
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
