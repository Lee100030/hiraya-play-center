import type { CenterSettings, HirayaUser, TeacherProfile } from '@hiraya/types';
import { buildCoeParagraphs, defaultCoeDraft, downloadCertificateOfEmployment, type CoeDraft, type CoeHonorific } from '@hiraya/utils';
import { Field, Input, Select, Textarea } from '@hiraya/ui';
import { useMemo, useState } from 'react';
import { EditorModal, FormSection } from './EditorModal';

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
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => buildCoeParagraphs(draft), [draft]);

  return (
    <EditorModal
      title={`Certificate of Employment — ${draft.fullName}`}
      error={error}
      submitLabel="Download PDF"
      legend={false}
      onClose={onClose}
      onSubmit={() => {
        setError(null);
        try {
          if (!draft.fullName.trim() || !draft.position.trim()) {
            throw new Error('Name and position are required.');
          }
          downloadCertificateOfEmployment(draft);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not download the certificate.');
        }
      }}
    >
      <FormSection title="Employee">
        <Field label="Honorific">
          <Select
            value={draft.honorific}
            onChange={(event) => patch(setDraft, draft, 'honorific', event.target.value as CoeHonorific)}
          >
            <option value="Mr.">Mr.</option>
            <option value="Ms.">Ms.</option>
            <option value="Mrs.">Mrs.</option>
            <option value="Mx.">Mx.</option>
          </Select>
        </Field>
        <Field label="Full name on certificate" required>
          <Input value={draft.fullName} onChange={(event) => patch(setDraft, draft, 'fullName', event.target.value)} required />
        </Field>
        <Field label="Last name (short form)">
          <Input value={draft.lastName} onChange={(event) => patch(setDraft, draft, 'lastName', event.target.value)} />
        </Field>
        <Field label="Position / job title" required>
          <Input value={draft.position} onChange={(event) => patch(setDraft, draft, 'position', event.target.value)} required />
        </Field>
        <Field label="Employed since">
          <Input type="date" value={draft.startDate} onChange={(event) => patch(setDraft, draft, 'startDate', event.target.value)} />
        </Field>
        <Field label="Monthly salary (optional)" optional hint="Leave blank to omit the salary sentence. Example: 15000">
          <Input value={draft.salaryAmount} onChange={(event) => patch(setDraft, draft, 'salaryAmount', event.target.value)} />
        </Field>
      </FormSection>
      <FormSection title="Letter">
        <div className="form-span">
          <Field label="Duties">
            <Textarea rows={4} value={draft.duties} onChange={(event) => patch(setDraft, draft, 'duties', event.target.value)} />
          </Field>
        </div>
        <div className="form-span">
          <Field label="Issued upon request">
            <Input value={draft.purpose} onChange={(event) => patch(setDraft, draft, 'purpose', event.target.value)} />
          </Field>
        </div>
        <Field label="Date issued">
          <Input type="date" value={draft.issuedOn} onChange={(event) => patch(setDraft, draft, 'issuedOn', event.target.value)} />
        </Field>
        <Field label="Place">
          <Input value={draft.centerPlace} onChange={(event) => patch(setDraft, draft, 'centerPlace', event.target.value)} />
        </Field>
      </FormSection>
      <FormSection title="Signatories">
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
      </FormSection>
      <div className="form-span coe-preview">
        <h3>Preview</h3>
        <p className="coe-kicker">{draft.centerName}</p>
        <p>{draft.centerPlace} | {draft.centerPhone}</p>
        <p className="coe-title">Certificate of Employment</p>
        <p>{preview.employment}</p>
        <p>{preview.duties}</p>
        <p>{preview.character}</p>
        <p>{preview.purpose}</p>
        <p>{preview.given}</p>
      </div>
    </EditorModal>
  );
}
