import type { HirayaDatabase, HirayaUser } from '@hiraya/types';
import { displayName, laneLabel, parentInLane, roleLabel, studentDisplay, type ManagementLaneId } from '@hiraya/utils';
import { Field, Input, Select, Button } from '@hiraya/ui';
import { FormEvent, useState } from 'react';
import { DirectMessageModal } from '../components/DirectMessageModal';
import { EditorModal, FormSection } from '../components/EditorModal';
import { ProfilePhotoField, saveAccountPhoto } from '../components/ProfilePhotoField';
import { ProfileFact, ProfileModal } from '../components/ProfileModal';
import { NameCell, RecordTable, StatusCell, assigned } from '../components/RecordTable';
import { api } from '../lib/api';
import { childrenOf } from '../lib/crud';
import { PAGE_COPY } from '../lib/views';

export function ParentsPage({
  store,
  onStore,
  onRefresh,
  actor,
  lane,
}: {
  store: HirayaDatabase;
  onStore: (next: HirayaDatabase) => void;
  onRefresh?: () => Promise<void> | void;
  actor: HirayaUser;
  lane?: ManagementLaneId | null;
}) {
  const rows = store.users.filter((item) => item.role === 'parent' && parentInLane(store, item.userId, lane));
  const [editing, setEditing] = useState<HirayaUser | null | 'new'>(null);
  const [linking, setLinking] = useState<HirayaUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkStudentId, setLinkStudentId] = useState('');
  const [linkRel, setLinkRel] = useState('Guardian');
  const [messaging, setMessaging] = useState<HirayaUser | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const current = editing && editing !== 'new' ? editing : null;
  const viewing = openId ? store.users.find((item) => item.userId === openId) : undefined;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    const payload = {
      firstName: String(form.get('firstName') || ''),
      middleName: String(form.get('middleName') || ''),
      lastName: String(form.get('lastName') || ''),
      email: String(form.get('email') || ''),
      personalEmail: String(form.get('personalEmail') || '').trim(),
      phone: String(form.get('phone') || ''),
      address: String(form.get('address') || ''),
      notes: String(form.get('notes') || ''),
      studentId: String(form.get('studentId') || '') || undefined,
      relationship: String(form.get('relationship') || 'Guardian'),
      ...(password ? { password, confirmPassword } : current ? {} : { password, confirmPassword }),
    };
    setBusy(true);
    setError(null);
    const formEl = event.currentTarget;
    try {
      let next;
      let photoUserId: string | undefined;
      if (current) {
        if (!current.userId) throw new Error('This parent record is missing an ID. Refresh and try again.');
        next = await api.updateParent(current.userId, payload);
        photoUserId = current.userId;
      } else {
        if (!password) throw new Error('Password is required for a new parent account.');
        next = await api.createParent({ ...payload, password, confirmPassword });
        photoUserId = next.users.find(
          (item) => item.role === 'parent' && item.email.toLowerCase() === payload.email.toLowerCase(),
        )?.userId;
      }
      onStore(next);
      try {
        const withPhoto = await saveAccountPhoto(photoUserId, form, formEl);
        if (withPhoto) onStore(withPhoto);
        setEditing(null);
        setNotice(current ? 'Parent saved.' : 'Parent created.');
      } catch (photoErr) {
        setError(
          photoErr instanceof Error
            ? `Account saved, but the photo did not upload: ${photoErr.message}. Restart the HIRAYA API (port 5188), then upload the photo again.`
            : 'Account saved, but the photo did not upload.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save parent');
    } finally {
      setBusy(false);
    }
  }

  async function archiveRows(picked: HirayaUser[]) {
    const targets = picked.filter((row) => row.status === 'active');
    if (!targets.length) {
      window.alert('Select active parent accounts to deactivate.');
      return false;
    }
    if (!window.confirm(`Deactivate ${targets.length === 1 ? displayName(targets[0]) : `${targets.length} parent accounts`}? They can be restored later.`)) {
      return false;
    }
    let next = store;
    for (const row of targets) {
      next = await api.setParentActive(row.userId, false);
    }
    onStore(next);
    setNotice(targets.length === 1 ? 'Parent deactivated.' : `${targets.length} parents deactivated.`);
  }

  async function removeRows(picked: HirayaUser[]) {
    if (!picked.length) return false;
    const names = picked.map(displayName).join(', ');
    if (
      !window.confirm(
        `Permanently delete ${picked.length === 1 ? names : `${picked.length} parent accounts`}? Linked children stay on file but lose this parent link. This cannot be undone.`,
      )
    ) {
      return false;
    }
    let next = store;
    for (const row of picked) {
      next = await api.deleteParent(row.userId);
    }
    onStore(next);
    setNotice(picked.length === 1 ? 'Parent deleted.' : `${picked.length} parents deleted.`);
  }

  async function restore(row: HirayaUser) {
    if (!window.confirm(`Activate ${displayName(row)}?`)) return;
    onStore(await api.setParentActive(row.userId, true));
    setNotice(`${displayName(row)} is active.`);
  }

  async function deactivateOne(row: HirayaUser) {
    if (!window.confirm(`Deactivate ${displayName(row)}? They can be restored from this profile.`)) return;
    setBusy(true);
    try {
      onStore(await api.setParentActive(row.userId, false));
      setNotice(`${displayName(row)} is inactive.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update parent status.');
    } finally {
      setBusy(false);
    }
  }

  async function linkChildInModal() {
    if (!current || !linkStudentId) return;
    setBusy(true);
    setError(null);
    try {
      onStore(await api.assignParentChild(current.userId, linkStudentId, linkRel));
      setLinkStudentId('');
      setNotice('Child linked to parent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign child');
    } finally {
      setBusy(false);
    }
  }
  async function unlink(parentId: string, studentId: string) {
    if (!window.confirm('Remove this child from the parent account?')) return;
    try {
      onStore(await api.removeParentChild(parentId, studentId));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not unlink child');
    }
  }

  async function onLink(event: FormEvent<HTMLFormElement>) {
    if (!linking) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      onStore(
        await api.assignParentChild(
          linking.userId,
          String(form.get('studentId') || ''),
          String(form.get('relationship') || 'Guardian'),
        ),
      );
      setLinking(null);
      setNotice('Child linked to parent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign child');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {notice ? (
        <p className="crud-notice" role="status" style={{ color: '#1f6b3a' }}>
          {notice}
        </p>
      ) : null}
      <RecordTable
        kicker="Management"
        title={lane ? `Parent management · ${laneLabel(lane)}` : PAGE_COPY.parents.title}
        description={lane ? `Guardians with children in ${laneLabel(lane)}.` : PAGE_COPY.parents.description}
        rows={rows}
        rowKey={(row) => row.userId}
        search={(row, q) => `${displayName(row)} ${row.email} ${row.phone}`.toLowerCase().includes(q)}
        searchPlaceholder="Filter this list of parents"
        emptyTitle="No parents found"
        emptyHint="Add a parent or guardian account, then link their children."
        statusOf={(row) => row.status}
        crud={{
          addLabel: '+ Add Parent',
          archiveLabel: 'Deactivate',
          onAdd: () => {
            setNotice(null);
            setEditing('new');
          },
          onEdit: (row) => {
            setNotice(null);
            setEditing(row);
          },
          onArchive: archiveRows,
          onDelete: removeRows,
          onRefresh,
          singleActions: [
            {
              icon: 'eye',
              label: 'Open profile',
              needOneMessage: 'Please select only one parent to open.',
              onClick: (row) => {
                setNotice(null);
                setOpenId(row.userId);
              },
            },
            {
              icon: 'chat',
              label: 'Message',
              needOneMessage: 'Please select only one parent to message.',
              onClick: (row) => {
                setNotice(null);
                setMessaging(row);
              },
            },
            {
              icon: 'link',
              label: 'Link Child',
              needOneMessage: 'Please select only one parent to link a child.',
              onClick: (row) => {
                setNotice(null);
                setLinking(row);
              },
            },
          ],
        }}
        columns={[
          {
            key: 'name',
            header: 'Parent name',
            render: (row) => (
              <NameCell name={displayName(row)} photo={row.profileImagePath ? api.profileMediaUrl(row.userId, row.updatedAt || row.profileImagePath) : undefined} />
            ),
          },
          { key: 'phone', header: 'Contact number', render: (row) => assigned(row.phone) },
          { key: 'email', header: 'Email', render: (row) => assigned(row.email) },
          {
            key: 'children',
            header: 'Linked children',
            render: (row) => assigned(childrenOf(store, row.userId).map(studentDisplay).join(', ')),
          },
          { key: 'status', header: 'Account status', render: (row) => <StatusCell value={row.status} /> },
        ]}
        card={{
          name: (row) => displayName(row),
          photo: (row) => (row.profileImagePath ? api.profileMediaUrl(row.userId, row.updatedAt || row.profileImagePath) : undefined),
          role: (row) => roleLabel(row.role),
          stat: (row) => {
            const n = childrenOf(store, row.userId).length;
            return n ? `${n} linked children` : 'No children linked';
          },
        }}
        onRowOpen={(row) => {
          setNotice(null);
          setOpenId(row.userId);
        }}
      />
      {viewing ? (
        <ProfileModal
          title="Parent profile"
          name={displayName(viewing)}
          subtitle={roleLabel(viewing.role)}
          status={viewing.status}
          photo={viewing.profileImagePath ? api.profileMediaUrl(viewing.userId, viewing.updatedAt || viewing.profileImagePath) : undefined}
          active={viewing.status === 'active'}
          toggleBusy={busy}
          onToggleActive={(next) => {
            if (next) void restore(viewing);
            else void deactivateOne(viewing);
          }}
          onClose={() => setOpenId(null)}
          actions={
            <div className="profile-modal-actions">
              <Button type="button" variant="ghost" onClick={() => setOpenId(null)}>
                Close
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpenId(null);
                  setMessaging(viewing);
                }}
              >
                Message
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpenId(null);
                  setLinking(viewing);
                }}
              >
                Link child
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setOpenId(null);
                  setEditing(viewing);
                }}
              >
                Edit
              </Button>
            </div>
          }
        >
          <ProfileFact label="Phone">{assigned(viewing.phone)}</ProfileFact>
          <ProfileFact label="Email">{assigned(viewing.email)}</ProfileFact>
          <ProfileFact label="Address">{assigned(viewing.address)}</ProfileFact>
          <ProfileFact label="Linked children">
            {assigned(childrenOf(store, viewing.userId).map(studentDisplay).join(', '))}
          </ProfileFact>
        </ProfileModal>
      ) : null}
      {messaging ? (
        <DirectMessageModal
          key={store.alerts.length}
          person={messaging}
          actorId={actor.userId}
          alerts={store.alerts}
          error={error}
          busy={busy}
          onClose={() => {
            setMessaging(null);
            setError(null);
          }}
          onSend={async (body) => {
            if (!body) {
              setError('Write a message first.');
              return;
            }
            setBusy(true);
            setError(null);
            try {
              onStore(await api.sendDirectMessage(messaging.userId, body));
              setNotice(`Message sent to ${displayName(messaging)}.`);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not send that message.');
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
      {editing ? (
        <EditorModal
          title={current ? `Edit ${displayName(current)}` : 'Add parent'}
          error={error}
          busy={busy}
          submitLabel={current ? 'Save parent' : 'Create parent'}
          onClose={() => setEditing(null)}
          onSubmit={onSubmit}
        >
          <FormSection title="Profile photo">
            <ProfilePhotoField userId={current?.userId} hasPhoto={Boolean(current?.profileImagePath)} cacheKey={current?.updatedAt} />
          </FormSection>
          <FormSection title="Personal info">
            <Field label="First name" required>
              <Input name="firstName" defaultValue={current?.firstName} required />
            </Field>
            <Field label="Middle name" optional>
              <Input name="middleName" defaultValue={current?.middleName} />
            </Field>
            <Field label="Last name" required>
              <Input name="lastName" defaultValue={current?.lastName} required />
            </Field>
            <Field label="Hiraya email" required hint="Sign-in address. This can stay on @hiraya.local.">
              <Input name="email" type="email" defaultValue={current?.email} required />
            </Field>
            <Field label="Personal email" optional hint="Real inbox such as Gmail. Payment mail is sent here.">
              <Input name="personalEmail" type="email" defaultValue={current?.personalEmail || ''} placeholder="name@gmail.com" />
            </Field>
            <Field label="Phone" required>
              <Input name="phone" defaultValue={current?.phone || ''} required />
            </Field>
            <Field label="Address" required>
              <Input name="address" defaultValue={current?.address} required />
            </Field>
          </FormSection>
          <FormSection title="Security">
            <Field label={current ? 'New password' : 'Password'} required={!current} optional={Boolean(current)}>
              <Input name="password" type="password" minLength={current ? undefined : 8} required={!current} />
            </Field>
            <Field
              label="Confirm password"
              required={!current}
              optional={Boolean(current)}
              hint={current ? 'Required only if you set a new password.' : undefined}
            >
              <Input name="confirmPassword" type="password" required={!current} />
            </Field>
          </FormSection>
          <FormSection title="Linked children">
            {current ? (
              <>
                {childrenOf(store, current.userId).length === 0 ? (
                  <p className="muted form-span">No children linked yet.</p>
                ) : (
                  <div className="child-chips form-span">
                    {childrenOf(store, current.userId).map((student) => (
                      <span key={student.studentId} className="child-chip">
                        {studentDisplay(student)}
                        <button type="button" aria-label={`Unlink ${studentDisplay(student)}`} onClick={() => void unlink(current.userId, student.studentId)}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="link-child-row form-span">
                  <Field label="Student">
                    <Select value={linkStudentId} onChange={(event) => setLinkStudentId(event.target.value)}>
                      <option value="">Select a student</option>
                      {store.students
                        .filter((student) => !childrenOf(store, current.userId).some((item) => item.studentId === student.studentId))
                        .map((student) => (
                          <option key={student.studentId} value={student.studentId}>
                            {studentDisplay(student)}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Field label="Relationship">
                    <Select value={linkRel} onChange={(event) => setLinkRel(event.target.value)}>
                      <option>Mother</option>
                      <option>Father</option>
                      <option>Guardian</option>
                      <option>Grandparent</option>
                      <option>Other</option>
                    </Select>
                  </Field>
                  <Button type="button" disabled={busy || !linkStudentId} onClick={() => void linkChildInModal()}>
                    + Link a child
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Field label="Link to student" optional>
                  <Select name="studentId" defaultValue="">
                    <option value="">None yet</option>
                    {store.students.map((student) => (
                      <option key={student.studentId} value={student.studentId}>
                        {studentDisplay(student)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Relationship" optional>
                  <Select name="relationship" defaultValue="Guardian">
                    <option>Mother</option>
                    <option>Father</option>
                    <option>Guardian</option>
                    <option>Grandparent</option>
                    <option>Other</option>
                  </Select>
                </Field>
              </>
            )}
          </FormSection>
        </EditorModal>
      ) : null}
      {linking ? (
        <EditorModal
          title={`Link child to ${displayName(linking)}`}
          error={error}
          busy={busy}
          submitLabel="Assign child"
          onClose={() => setLinking(null)}
          onSubmit={onLink}
        >
          <FormSection title="Student">
          <Field label="Student" required>
            <Select name="studentId" required defaultValue="">
              <option value="" disabled>
                Select a student
              </option>
              {store.students.map((student) => (
                <option key={student.studentId} value={student.studentId}>
                  {studentDisplay(student)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Relationship">
            <Select name="relationship" defaultValue="Guardian">
              <option>Mother</option>
              <option>Father</option>
              <option>Guardian</option>
              <option>Grandparent</option>
              <option>Other</option>
            </Select>
          </Field>
          </FormSection>
        </EditorModal>
      ) : null}
    </>
  );
}
