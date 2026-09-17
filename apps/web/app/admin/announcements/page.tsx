'use client';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { Button, EmptyState, Field, Input, Loading, Select, StatusBadge, Textarea } from '@hiraya/ui';
import { newId } from '@hiraya/utils';
import type { NewsItem } from '@hiraya/types';
import { FormEvent, useState } from 'react';

export default function AdminAnnouncementsPage() {
  const { user } = useAuth();
  const { store, loading, save } = useStore();
  const [open, setOpen] = useState(false);

  const [editing, setEditing] = useState<NewsItem | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const status = String(form.get('status') || 'published');
    const next: NewsItem = {
      newsId: editing?.newsId || newId('nws'),
      title: String(form.get('title') || '').trim(),
      body: String(form.get('body') || '').trim(),
      publishedAt: editing?.publishedAt || new Date().toISOString(),
      isPublished: status === 'published',
      status,
      createdBy: user?.userId || '',
      audience: String(form.get('audience') || 'everyone'),
      audienceId: String(form.get('audienceId') || ''),
      priority: String(form.get('priority') || 'normal'),
      expiresAt: String(form.get('expiresAt') || ''),
    };
    await save({
      ...store,
      news: editing ? store.news.map((item) => (item.newsId === next.newsId ? next : item)) : [...store.news, next],
    });
    setOpen(false);
    setEditing(null);
  }

  if (loading) return <Loading />;
  return (
    <>
      <AdminPageHeader
        kicker="Management"
        title="Announcement management"
        description="Published notices appear on teacher and parent mobile apps for the selected audience."
        actions={
          <button
            type="button"
            className="dash-action dash-action-primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            + Add Announcement
          </button>
        }
      />
      {open || editing ? (
        <form className="hlc-card form-grid" onSubmit={onSubmit}>
          <Field label="Title" required>
            <Input name="title" defaultValue={editing?.title} required />
          </Field>
          <Field label="Content" required>
            <Textarea name="body" defaultValue={editing?.body} required />
          </Field>
          <Field label="Audience">
            <Select name="audience" defaultValue={editing?.audience || 'everyone'}>
              <option value="everyone">All users</option>
              <option value="teachers">Teachers</option>
              <option value="parents">Parents</option>
            </Select>
          </Field>
          <Field label="Specific person (optional)">
            <Select name="audienceId" defaultValue={editing?.audienceId || ''}>
              <option value="">None</option>
              {store.users
                .filter((item) => item.role === 'teacher' || item.role === 'parent')
                .map((item) => (
                  <option key={item.userId} value={item.userId}>
                    {item.role}: {item.fullname || item.email}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select name="priority" defaultValue={editing?.priority || 'normal'}>
              <option value="normal">normal</option>
              <option value="high">high</option>
            </Select>
          </Field>
          <Field label="Expires">
            <Input name="expiresAt" type="date" defaultValue={editing?.expiresAt} />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={editing?.status || 'published'}>
              <option value="published">published</option>
              <option value="draft">unpublished</option>
              <option value="archived">archived</option>
            </Select>
          </Field>
          <Button type="submit">{editing ? 'Save' : 'Publish'}</Button>{' '}
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setEditing(null);
            }}
          >
            Cancel
          </Button>
        </form>
      ) : null}
      {store.news.length === 0 ? (
        <EmptyState title="No announcements" />
      ) : (
        store.news.map((row) => (
          <article key={row.newsId} className="hlc-card">
            <h3>{row.title}</h3>
            <StatusBadge status={row.status} />
            <p>{row.body}</p>
            <p>{row.audience || 'everyone'}</p>
            <button type="button" className="dash-action" onClick={() => setEditing(row)}>
              Edit
            </button>
          </article>
        ))
      )}
    </>
  );
}
