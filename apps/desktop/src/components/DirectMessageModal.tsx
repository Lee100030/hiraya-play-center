import type { HirayaUser, SystemAlert } from '@hiraya/types';
import { displayName } from '@hiraya/utils';
import { Field, Textarea } from '@hiraya/ui';
import { FormEvent, useMemo } from 'react';
import { directThreadKey, threadMessages } from '../lib/messages';
import { EditorModal, FormSection } from './EditorModal';

export { directThreadKey };

export function DirectMessageModal({
  person,
  actorId,
  alerts,
  error,
  busy,
  onClose,
  onSend,
}: {
  person: HirayaUser;
  actorId: string;
  alerts: SystemAlert[];
  error?: string | null;
  busy?: boolean;
  onClose: () => void;
  onSend: (body: string) => void | Promise<void>;
}) {
  const rows = useMemo(() => threadMessages(alerts, actorId, person.userId), [alerts, actorId, person.userId]);
  const name = displayName(person);

  return (
    <EditorModal
      title={`Message ${name}`}
      error={error}
      busy={busy}
      submitLabel={busy ? 'Sending…' : 'Send message'}
      onClose={onClose}
      onSubmit={async (event: FormEvent<HTMLFormElement>) => {
        const form = new FormData(event.currentTarget);
        const body = String(form.get('body') || '').trim();
        await onSend(body);
      }}
    >
      <FormSection title="Conversation">
        {rows.length === 0 ? (
          <p className="muted">No messages yet. Write the first note for this {person.role === 'parent' ? 'parent' : 'teacher'}.</p>
        ) : (
          <div className="dm-thread">
            {rows.map((row) => (
              <article key={row.alertId} className={row.status === 'sent' ? 'dm-bubble is-mine' : 'dm-bubble'}>
                <p>{row.message}</p>
                <small>
                  {row.status === 'sent' ? 'You' : name} ·{' '}
                  {row.createdAt ? new Date(row.createdAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                </small>
              </article>
            ))}
          </div>
        )}
        <Field label="Message" required>
          <Textarea name="body" required rows={4} placeholder={`Write a message to ${name}`} />
        </Field>
      </FormSection>
    </EditorModal>
  );
}
