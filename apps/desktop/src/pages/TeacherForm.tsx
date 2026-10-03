import type { HirayaDatabase, HirayaUser, TeacherProfile } from '@hiraya/types';
import { displayName } from '@hiraya/utils';
import { Field, Input, ProgramSpecialtySelect, Select, Textarea } from '@hiraya/ui';
import type { FormEvent } from 'react';
import { EditorModal, FormSection } from '../components/EditorModal';
import { ProfilePhotoField } from '../components/ProfilePhotoField';

export function StaffForm({
  user,
  profile,
  store,
  error,
  busy,
  onClose,
  onSubmit,
}: {
  user: HirayaUser | null;
  profile?: TeacherProfile;
  store?: HirayaDatabase | null;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <EditorModal
      title={user ? `Edit ${displayName(user)}` : 'Add teacher'}
      error={error}
      busy={busy}
      submitLabel={user ? 'Save account' : 'Create account'}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <FormSection title="Profile photo">
        <ProfilePhotoField userId={user?.userId} hasPhoto={Boolean(user?.profileImagePath)} cacheKey={user?.updatedAt} />
      </FormSection>
      <FormSection title="Personal info">
        <Field label="First name" required>
          <Input name="firstName" defaultValue={user?.firstName} required />
        </Field>
        <Field label="Middle name" optional>
          <Input name="middleName" defaultValue={user?.middleName} />
        </Field>
        <Field label="Last name" required>
          <Input name="lastName" defaultValue={user?.lastName || (user ? displayName(user) : '')} required />
        </Field>
        <Field label="Hiraya email" required hint="Sign-in address. This can stay on @hiraya.local.">
          <Input name="email" type="email" defaultValue={user?.email} required />
        </Field>
        <Field label="Personal email" optional hint="Real inbox such as Gmail. Payment mail is sent here.">
          <Input name="personalEmail" type="email" defaultValue={user?.personalEmail || ''} placeholder="name@gmail.com" />
        </Field>
        <Field label="Contact number" required>
          <Input name="phone" defaultValue={user?.phone || ''} required />
        </Field>
        <Field label="Address" optional>
          <Input name="address" defaultValue={user?.address} />
        </Field>
        <Field
          label="Specialization"
          optional
          hint="Playgroup, Pre-kinder, Kinder, Nursery, Grade 1–3, ABA Therapy, or Tutorial Session. That teacher appears in the matching Teachers Management list."
        >
          <ProgramSpecialtySelect key={user?.userId || 'new'} value={profile?.specialty} store={store} />
        </Field>
        <input type="hidden" name="role" value="teacher" />
        <Field label="Employee code" optional>
          <Input name="employeeCode" defaultValue={profile?.employeeCode} />
        </Field>
        <Field label="Position / job title" optional hint="Used on the Certificate of Employment. Example: Teacher or Marketing Assistant.">
          <Input name="position" defaultValue={profile?.position || user?.position || 'Teacher'} />
        </Field>
        <Field label="Date hired" optional>
          <Input name="hireDate" type="date" defaultValue={(profile?.hireDate || '').slice(0, 10)} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={user?.status || 'active'}>
            <option value="active">Active</option>
            <option value="deactivated">Inactive</option>
          </Select>
        </Field>
        <div className="form-span">
          <Field label="Notes" optional>
            <Textarea name="notes" defaultValue={user?.notes} />
          </Field>
        </div>
        <div className="form-span">
          <Field label="Bio" optional>
            <Input name="bio" defaultValue={profile?.bio} />
          </Field>
        </div>
      </FormSection>
      <FormSection title="Security">
        <Field label={user ? 'New password' : 'Password'} required={!user} optional={Boolean(user)}>
          <Input name="password" type="password" minLength={user ? undefined : 8} required={!user} />
        </Field>
        <Field
          label="Confirm password"
          required={!user}
          optional={Boolean(user)}
          hint={user ? 'Required only if you set a new password.' : undefined}
        >
          <Input name="confirmPassword" type="password" required={!user} />
        </Field>
      </FormSection>
    </EditorModal>
  );
}
