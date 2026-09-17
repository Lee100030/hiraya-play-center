'use client';

import { AdminModal } from '@/components/admin/AdminModal';
import { Button, Field, Input, Select, Textarea } from '@hiraya/ui';
import { buildCoeParagraphs, defaultCoeDraft, downloadCertificateOfEmployment, type CoeDraft, type CoeHonorific } from '@hiraya/utils';
import type { CenterSettings, HirayaUser, TeacherProfile } from '@hiraya/types';
import { FormEvent, useMemo, useState } from 'react';

function patch<K extends keyof CoeDraft>(setDraft: (next: CoeDraft) => void, draft: CoeDraft, key: K, value: CoeDraft[K]) {
  setDraft({ ...draft, [key]: value });
}

export function CertificateModal({
  user,
  profile,
  settings,
  onClose,
}: {
  user: HirayaUser;
  profile?: TeacherProfile;
  settings: CenterSettings;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => defaultCoeDraft(user, profile, settings));
  const [error, setError] = useState('');
  const preview = useMemo(() => buildCoeParagraphs(draft), [draft]);

  function onPrint(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      if (!draft.fullName.trim() || !draft.position.trim()) {
        throw new Error('Name and position are required.');
      }
      downloadCertificateOfEmployment(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the certificate.');
    }
  }

  return (
    <AdminModal
      size="lg"
      title={`Certificate of Employment — ${draft.fullName}`}
      description="Edit the letter if needed, then download the PDF. Teachers are employees of the center."
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" form="coe-form">
            Download PDF
          </Button>
        </>
      }
    >
      <form id="coe-form" className="form-grid" onSubmit={onPrint}>
        {error ? <p className="hlc-field-error">{error}</p> : null}
        <Field label="Honorific">
          <Select value={draft.honorific} onChange={(event) => patch(setDraft, draft, 'honorific', event.target.value as CoeHonorific)}>
            <option value="Mr.">Mr.</option>
            <option value="Ms.">Ms.</option>
            <option value="Mrs.">Mrs.</option>
            <option value="Mx.">Mx.</option>
          </Select>
        </Field>
        <Field label="Full name" required>
          <Input value={draft.fullName} onChange={(event) => patch(setDraft, draft, 'fullName', event.target.value)} required />
        </Field>
        <Field label="Position / job title" required>
          <Input value={draft.position} onChange={(event) => patch(setDraft, draft, 'position', event.target.value)} required />
        </Field>
        <Field label="Employed since">
          <Input type="date" value={draft.startDate} onChange={(event) => patch(setDraft, draft, 'startDate', event.target.value)} />
        </Field>
        <Field label="Monthly salary (optional)">
          <Input value={draft.salaryAmount} onChange={(event) => patch(setDraft, draft, 'salaryAmount', event.target.value)} placeholder="15000" />
        </Field>
        <Field label="Last name (short form)">
          <Input value={draft.lastName} onChange={(event) => patch(setDraft, draft, 'lastName', event.target.value)} />
        </Field>
        <Field label="Duties">
          <Textarea rows={4} value={draft.duties} onChange={(event) => patch(setDraft, draft, 'duties', event.target.value)} />
        </Field>
        <Field label="Issued upon request">
          <Input value={draft.purpose} onChange={(event) => patch(setDraft, draft, 'purpose', event.target.value)} />
        </Field>
        <Field label="Date issued">
          <Input type="date" value={draft.issuedOn} onChange={(event) => patch(setDraft, draft, 'issuedOn', event.target.value)} />
        </Field>
        <Field label="Place">
          <Input value={draft.centerPlace} onChange={(event) => patch(setDraft, draft, 'centerPlace', event.target.value)} />
        </Field>
        <Field label="First signatory">
          <Input value={draft.signer1Name} onChange={(event) => patch(setDraft, draft, 'signer1Name', event.target.value)} />
        </Field>
        <Field label="Title">
          <Input value={draft.signer1Title} onChange={(event) => patch(setDraft, draft, 'signer1Title', event.target.value)} />
        </Field>
        <Field label="Second signatory">
          <Input value={draft.signer2Name} onChange={(event) => patch(setDraft, draft, 'signer2Name', event.target.value)} />
        </Field>
        <Field label="Title">
          <Input value={draft.signer2Title} onChange={(event) => patch(setDraft, draft, 'signer2Title', event.target.value)} />
        </Field>
      </form>
      <article className="coe-preview">
        <h3>Preview</h3>
        <p className="coe-kicker">{draft.centerName}</p>
        <p>
          {draft.centerPlace} | {draft.centerPhone}
        </p>
        <p className="coe-title">Certificate of Employment</p>
        <p>{preview.employment}</p>
        <p>{preview.duties}</p>
        <p>{preview.character}</p>
        <p>{preview.purpose}</p>
        <p>{preview.given}</p>
      </article>
    </AdminModal>
  );
}
