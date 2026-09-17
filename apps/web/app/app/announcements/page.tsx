'use client';

import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, StatusBadge, Textarea } from '@hiraya/ui';
import { newId } from '@hiraya/utils';
import { FormEvent, useState } from 'react';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  const [open, setOpen] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await save({
      ...store,
      news: [
        {
          newsId: newId('news'),
          title: String(form.get('title') || ''),
          body: String(form.get('body') || ''),
          publishedAt: new Date().toISOString(),
          isPublished: true,
          status: 'published',
          createdBy: user?.userId || '',
        },
        ...store.news,
      ],
    });
    setOpen(false);
  }

  if (loading) return <Loading />;

  return (
    <>
      <div className="toolbar">
        <h1>Announcements</h1>
        <Button type="button" onClick={() => setOpen(true)}>
          Post
        </Button>
      </div>
      {open ? (
        <form className="hlc-card form-grid" onSubmit={onSubmit}>
          <Field label="Title" required>
            <Input name="title" required />
          </Field>
          <Field label="Body" required>
            <Textarea name="body" required />
          </Field>
          <div>
            <Button type="submit">Publish</Button>{' '}
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {store.news.length === 0 ? (
        <EmptyState title="No announcements" />
      ) : (
        store.news.map((item) => (
          <article key={item.newsId} className="hlc-card" style={{ marginBottom: 12 }}>
            <h2>{item.title}</h2>
            <StatusBadge status={item.status} />
            <p>{item.body}</p>
          </article>
        ))
      )}
    </>
  );
}
