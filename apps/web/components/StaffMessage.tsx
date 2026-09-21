'use client';

import { useState } from 'react';
import { MessageComposer, MessageIconButton } from '@hiraya/ui';
import { appendStaffMessages, displayName, mobileRecipientIdsForStudent, studentDisplay } from '@hiraya/utils';
import type { HirayaDatabase, HirayaUser, Student } from '@hiraya/types';

type MessageTarget = { label: string; hint?: string; recipientIds: string[] };

export function StudentMessageButton({
  store,
  student,
  onOpen,
}: {
  store: HirayaDatabase;
  student: Student;
  onOpen: (target: MessageTarget) => void;
}) {
  return (
    <MessageIconButton
      onClick={() =>
        onOpen({
          label: studentDisplay(student),
          hint: 'Students do not have app logins. This is sent to the linked parent’s Alerts tab.',
          recipientIds: mobileRecipientIdsForStudent(store, student),
        })
      }
    />
  );
}

export function UserMessageButton({
  user,
  hint,
  onOpen,
}: {
  user: HirayaUser;
  hint: string;
  onOpen: (target: MessageTarget) => void;
}) {
  return (
    <MessageIconButton
      onClick={() =>
        onOpen({
          label: displayName(user),
          hint,
          recipientIds: [user.userId],
        })
      }
    />
  );
}

export function StaffMessageHost({
  store,
  save,
  target,
  onClose,
}: {
  store: HirayaDatabase;
  save: (next: HirayaDatabase) => Promise<void>;
  target: MessageTarget | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!target) return null;
  return (
    <MessageComposer
      toLabel={target.label}
      toHint={target.hint}
      busy={busy}
      error={error}
      onClose={onClose}
      onSend={(payload) => {
        void (async () => {
          if (!target.recipientIds.length) {
            setError('No mobile account is linked to receive this.');
            return;
          }
          setBusy(true);
          setError('');
          try {
            await save(appendStaffMessages(store, target.recipientIds, payload.message, payload.title));
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send');
          } finally {
            setBusy(false);
          }
        })();
      }}
    />
  );
}
