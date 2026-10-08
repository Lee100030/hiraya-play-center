import type { HirayaDatabase, HirayaUser, Student } from '@hiraya/types';
import { addLearningProgram, compareStudentNames, confirmStudentPresentToday, displayName, downloadStudentRecord, isStudentHereToday, laneLabel, paymentBalanceLabel, removeStudentLinkedRecords, resolveStudentProgramValue, sessionLeftFor, sessionLeftLabel, studentDayAttendance, studentDisplay, studentInLane, studentPaymentBalance, studentTuitionFee, upsertStudentBalance, upsertStudentSessions, type ManagementLaneId } from '@hiraya/utils';
import { Field, Input, ProgramSpecialtySelect, Select, Button } from '@hiraya/ui';
import { FormEvent, useState } from 'react';
import { DirectMessageModal } from '../components/DirectMessageModal';
import { LaneSessionPackage } from '../components/LaneSessionPackage';
import { DeskModal } from '../components/DeskModal';
import { EditorModal, FormSection } from '../components/EditorModal';
import { ProfileFact, ProfileModal } from '../components/ProfileModal';
import { ProfilePhotoField, saveStudentPhoto } from '../components/ProfilePhotoField';
import { StudentFilesPanel } from '../components/StudentFilesPanel';
import { EmptyCell, NameCell, RecordTable, StatusCell, assigned } from '../components/RecordTable';
import {
  ageFromBirthdate,
  parentOptions,
  studentPlacement,
  studentRecord,
  withParentLink,
} from '../lib/crud';
import { api } from '../lib/api';
import { PAGE_COPY } from '../lib/views';

export function StudentsPage({
  store,
  onStore,
  saveStore,
  onRefresh,
  actor,
  lane,
}: {
  store: HirayaDatabase;
  onStore?: (next: HirayaDatabase) => void;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onRefresh?: () => Promise<void> | void;
  actor?: HirayaUser;
  lane?: ManagementLaneId | null;
}) {
  const [editing, setEditing] = useState<Student | null | 'new'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [messaging, setMessaging] = useState<HirayaUser | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filesOpen, setFilesOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [programChoice, setProgramChoice] = useState('');
  const [addingProgram, setAddingProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramNote, setNewProgramNote] = useState('');
  const [programBusy, setProgramBusy] = useState(false);
  const current = editing && editing !== 'new' ? editing : null;
  const rows = store.students.filter((row) => studentInLane(store, row, lane)).sort(compareStudentNames);
  const viewing = openId ? store.students.find((row) => row.studentId === openId) : undefined;
  const viewingParent = viewing ? store.users.find((item) => item.userId === viewing.parentId && item.role === 'parent') : undefined;
  const viewingPlace = viewing ? studentPlacement(store, viewing.studentId) : undefined;
  const viewingFileCount = viewing
    ? (store.studentDocuments || []).filter((item) => item.studentId === viewing.studentId).length
    : 0;
  const editorSessions = sessionLeftFor(store, current?.studentId || '');
  const editorBill = studentPaymentBalance(store, current?.studentId || '');

  function studentPhoto(row?: Student) {
    if (!row?.profileImagePath) return undefined;
    return api.studentPhotoUrl(row.studentId, row.profileImagePath);
  }

  async function uploadPickedStudentPhoto(row: Student, file: File) {
    setPhotoBusy(true);
    setError(null);
    try {
      onStore?.(await api.uploadStudentPhoto(row.studentId, file, file.name || 'photo.jpg'));
      setNotice(`Photo saved for ${studentDisplay(row)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that photo.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function clearStudentPhoto(row: Student) {
    if (!window.confirm(`Remove the photo for ${studentDisplay(row)}?`)) return;
    setPhotoBusy(true);
    setError(null);
    try {
      onStore?.(await api.removeStudentPhoto(row.studentId));
      setNotice(`Photo removed for ${studentDisplay(row)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that photo.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function persist(next: HirayaDatabase, message: string) {
    await saveStore(next);
    setNotice(message);
    setEditing(null);
    setAddingProgram(false);
  }

  function openEditor(next: Student | 'new') {
    setNotice(null);
    setError(null);
    setAddingProgram(false);
    setNewProgramName('');
    setNewProgramNote('');
    setProgramChoice(next === 'new' ? '' : next.program || '');
    setEditing(next);
  }

  async function saveCustomProgram() {
    setProgramBusy(true);
    setError(null);
    try {
      const result = addLearningProgram(store, newProgramName, newProgramNote);
      if (result.created) await saveStore(result.store);
      setProgramChoice(result.program.name);
      setAddingProgram(false);
      setNewProgramName('');
      setNewProgramNote('');
      setNotice(result.created ? `${result.program.name} was added to programs.` : `${result.program.name} is already on the program list.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that program.');
    } finally {
      setProgramBusy(false);
    }
  }

  async function markHereToday(row: Student) {
    if (isStudentHereToday(store, row.studentId)) {
      setNotice(`${studentDisplay(row)} is already marked as here today.`);
      return;
    }
    const name = studentDisplay(row);
    if (
      !window.confirm(
        `Confirm that ${name} is at the center today? This records attendance. If they have a session package, one session is used.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = confirmStudentPresentToday(store, row.studentId, actor?.userId || '');
      await saveStore(next);
      const left = sessionLeftFor(next, row.studentId);
      setNotice(
        left.hasPackage
          ? `${name} is in class. ${left.remaining} session${left.remaining === 1 ? '' : 's'} left of ${left.total}.`
          : `${name} is marked as here today. No session package is assigned yet.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record attendance');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const birthdate = String(form.get('birthdate') || '');
    const parentId = String(form.get('parentId') || '');
    const slot = String(form.get('slot') || '').trim();
    const next = studentRecord({
      ...(current || {}),
      firstName: String(form.get('firstName') || ''),
      middleName: String(form.get('middleName') || ''),
      lastName: String(form.get('lastName') || ''),
      birthdate,
      age: ageFromBirthdate(birthdate),
      gender: String(form.get('gender') || ''),
      program: resolveStudentProgramValue(String(form.get('specialty') || form.get('program') || programChoice || ''), store),
      contactNumber: String(form.get('contactNumber') || ''),
      address: String(form.get('address') || ''),
      parentId,
      status: String(form.get('status') || 'active'),
      notes: String(form.get('notes') || ''),
      gradeLevel: resolveStudentProgramValue(
        String(form.get('specialty') || form.get('program') || programChoice || current?.gradeLevel || ''),
        store,
      ),
    });
    let working = store;
    if (next.program) {
      const ensured = addLearningProgram(working, next.program);
      working = ensured.store;
    }
    const students = current
      ? working.students.map((item) => (item.studentId === next.studentId ? next : item))
      : [...working.students, next];
    setBusy(true);
    setError(null);
    try {
      if (!parentId) throw new Error('Link a parent account. Children do not sign in; parents use the app.');
      const ops = working.studentOps.filter((item) => item.studentId !== next.studentId);
      const currentOps = working.studentOps.find((item) => item.studentId === next.studentId);
      const parentStudents = parentId ? withParentLink(working, parentId, next.studentId) : working.parentStudents;
      const remaining = String(form.get('sessionsRemaining') || '').trim();
      const total = String(form.get('sessionsTotal') || '').trim();
      const programId = working.programs.find((item) => item.name === next.program)?.programId || '';
      await saveStore(
        upsertStudentBalance(
          upsertStudentSessions(
            {
              ...working,
              students,
              studentOps: [
                ...ops,
                {
                  studentId: next.studentId,
                  paymentStatus: currentOps?.paymentStatus || '',
                  collector: currentOps?.collector || '',
                  hasIdCard: currentOps?.hasIdCard || false,
                  hasFetcherId: currentOps?.hasFetcherId || false,
                  hasNametag: currentOps?.hasNametag || false,
                  feeAmount: currentOps?.feeAmount || 0,
                  tuitionFee: currentOps?.tuitionFee || 0,
                  laceAmount: currentOps?.laceAmount || 0,
                  currentSlot: slot,
                  package: currentOps?.package || '',
                },
              ],
              parentStudents,
            },
            next.studentId,
            remaining,
            total,
            programId,
          ),
          next.studentId,
          String(form.get('paymentBalance') || '').trim(),
          String(form.get('paymentStatus') || '').trim(),
          actor?.userId || '',
        ),
      );
      try {
        const withPhoto = await saveStudentPhoto(next.studentId, form, formEl);
        if (withPhoto) onStore?.(withPhoto);
        setNotice(current ? 'Student saved.' : 'Student created.');
        setEditing(null);
        setAddingProgram(false);
      } catch (photoErr) {
        setError(
          photoErr instanceof Error
            ? `Student saved, but the photo did not upload: ${photoErr.message}. Restart the HIRAYA API (port 5188), then edit this student and upload the photo again.`
            : 'Student saved, but the photo did not upload. Restart the HIRAYA API and try the photo again.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save student');
    } finally {
      setBusy(false);
    }
  }

  async function archiveRows(rows: Student[]) {
    if (!rows.length) return false;
    const names = rows.map(studentDisplay).join(', ');
    if (!window.confirm(`Archive ${rows.length === 1 ? names : `${rows.length} students`}? They stay in history and can be restored.`)) {
      return false;
    }
    const ids = new Set(rows.map((row) => row.studentId));
    await persist(
      {
        ...store,
        students: store.students.map((item) =>
          ids.has(item.studentId) && item.status === 'active' ? { ...item, status: 'archived' } : item,
        ),
      },
      rows.length === 1 ? 'Student archived.' : `${rows.length} students archived.`,
    );
  }

  async function removeRows(rows: Student[]) {
    if (!rows.length) return false;
    if (
      !window.confirm(
        `Delete ${rows.length === 1 ? studentDisplay(rows[0]) : `${rows.length} students`}, related enrollments, session packages, and counted payments? Prefer Archive unless this was added by mistake.`,
      )
    ) {
      return false;
    }
    await persist(
      removeStudentLinkedRecords(
        store,
        rows.map((row) => row.studentId),
      ),
      rows.length === 1 ? 'Student deleted.' : `${rows.length} students deleted.`,
    );
  }

  async function setStudentStatus(row: Student, status: 'active' | 'inactive') {
    if (status === 'inactive' && !window.confirm(`Set ${studentDisplay(row)} inactive?`)) return;
    setBusy(true);
    setError(null);
    try {
      await saveStore({
        ...store,
        students: store.students.map((item) => (item.studentId === row.studentId ? { ...item, status } : item)),
      });
      setNotice(status === 'active' ? `${studentDisplay(row)} is active.` : `${studentDisplay(row)} is inactive.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update student status');
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
      {error && !editing ? (
        <p className="crud-notice crud-notice-error" role="alert">
          {error}
        </p>
      ) : null}
      {lane ? <LaneSessionPackage store={store} lane={lane} saveStore={saveStore} /> : null}
      <RecordTable
        kicker="Management"
        title={lane ? `Student management · ${laneLabel(lane)}` : PAGE_COPY.students.title}
        description={
          lane
            ? `Learners in ${laneLabel(lane)}.`
            : PAGE_COPY.students.description
        }
        rows={rows}
        rowKey={(row) => row.studentId}
        search={(row, q) =>
          `${studentDisplay(row)} ${row.studentId} ${row.program} ${row.contactNumber}`.toLowerCase().includes(q)
        }
        searchPlaceholder="Filter this list of students"
        emptyTitle="No students found"
        emptyHint="Add a student, or approve an enrollment application to create one automatically."
        statusOf={(row) => row.status}
        crud={{
          addLabel: '+ Add Student',
          onAdd: () => openEditor('new'),
          onEdit: (row) => openEditor(row),
          onArchive: archiveRows,
          onDelete: removeRows,
          onRefresh,
          singleActions: [
            {
              label: 'Student record',
              icon: 'file',
              needOneMessage: 'Select one student to save their record.',
              onClick: (row) => {
                setNotice(null);
                setError(null);
                try {
                  downloadStudentRecord(store, row.studentId);
                  setNotice(`Saved a one-page record for ${studentDisplay(row)}.`);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not save the student record.');
                }
              },
            },
            {
              label: 'Open profile',
              icon: 'eye',
              needOneMessage: 'Select one student to open.',
              onClick: (row) => {
                setNotice(null);
                setOpenId(row.studentId);
              },
            },
            {
              label: 'Message parent',
              icon: 'chat',
              needOneMessage: 'Select one student to message their parent.',
              onClick: (row) => {
                const parent = store.users.find((item) => item.userId === row.parentId && item.role === 'parent');
                if (!parent) {
                  setNotice('No parent account is linked to this student.');
                  return;
                }
                setNotice(null);
                setMessaging(parent);
              },
            },
            {
              label: 'Here today',
              icon: 'check',
              needOneMessage: 'Select one student to mark as here today.',
              onClick: (row) => void markHereToday(row),
            },
          ],
        }}
        columns={[
          { key: 'name', header: 'Student name', render: (row) => <NameCell name={studentDisplay(row)} photo={studentPhoto(row)} /> },
          { key: 'number', header: 'Student number', render: (row) => assigned(row.studentId) },
          {
            key: 'parent',
            header: 'Parent / guardian',
            render: (row) => assigned(displayName(store.users.find((item) => item.userId === row.parentId))),
          },
          {
            key: 'program',
            header: 'Program',
            render: (row) => assigned(studentPlacement(store, row.studentId).programName || row.program),
          },
          {
            key: 'class',
            header: 'Class',
            priority: 'secondary',
            render: (row) => assigned(studentPlacement(store, row.studentId).className),
          },
          {
            key: 'teacher',
            header: 'Assigned teacher',
            render: (row) => assigned(studentPlacement(store, row.studentId).teacherName),
          },
          {
            key: 'today',
            header: 'Today',
            render: (row) => {
              const today = studentDayAttendance(store, row.studentId);
              if (isStudentHereToday(store, row.studentId)) {
                return <StatusCell value={today?.status || 'present'} />;
              }
              if (today?.status) return <StatusCell value={today.status} />;
              return (
                <button
                  type="button"
                  className="linkish"
                  disabled={busy}
                  onClick={(event) => {
                    event.stopPropagation();
                    void markHereToday(row);
                  }}
                >
                  Mark here today
                </button>
              );
            },
          },
          {
            key: 'sessions',
            header: 'Sessions left',
            priority: 'secondary',
            render: (row) => sessionLeftLabel(store, row.studentId),
          },
          {
            key: 'balance',
            header: 'Remaining balance',
            priority: 'secondary',
            render: (row) => paymentBalanceLabel(store, row.studentId) || <EmptyCell />,
          },
          {
            key: 'enroll',
            header: 'Enrollment',
            render: (row) => <StatusCell value={studentPlacement(store, row.studentId).enrollmentStatus} />,
          },
          { key: 'status', header: 'Student status', render: (row) => <StatusCell value={row.status} /> },
        ]}
        card={{
          name: (row) => studentDisplay(row),
          photo: (row) => studentPhoto(row),
          role: () => 'Student',
          stat: (row) => {
            const place = studentPlacement(store, row.studentId);
            const program = place.programName || row.program || 'Program not set';
            const pack = sessionLeftFor(store, row.studentId);
            const sessions = pack.hasPackage ? sessionLeftLabel(store, row.studentId) : '';
            const balance = studentPaymentBalance(store, row.studentId).due > 0 ? paymentBalanceLabel(store, row.studentId) : '';
            return [program, sessions && `Sessions: ${sessions}`, balance && `Balance: ${balance}`].filter(Boolean).join(' · ');
          },
        }}
        onRowOpen={(row) => {
          setNotice(null);
          setFilesOpen(false);
          setOpenId(row.studentId);
        }}
      />
      {viewing ? (
        <ProfileModal
          title="Student profile"
          name={studentDisplay(viewing)}
          photo={studentPhoto(viewing)}
          subtitle={viewingPlace?.programName || viewing.program || 'Learner'}
          status={viewing.status}
          active={viewing.status === 'active'}
          toggleBusy={busy}
          photoEditable
          photoBusy={photoBusy}
          onPickPhoto={(file) => void uploadPickedStudentPhoto(viewing, file)}
          onRemovePhoto={() => void clearStudentPhoto(viewing)}
          onToggleActive={(next) => void setStudentStatus(viewing, next ? 'active' : 'inactive')}
          onClose={() => {
            setFilesOpen(false);
            setOpenId(null);
          }}
          actions={
            <div className="profile-modal-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFilesOpen(false);
                  setOpenId(null);
                }}
              >
                Close
              </Button>
              {viewingParent ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setFilesOpen(false);
                    setOpenId(null);
                    setMessaging(viewingParent);
                  }}
                >
                  Message parent
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  try {
                    downloadStudentRecord(store, viewing.studentId);
                    setNotice(`Saved a one-page record for ${studentDisplay(viewing)}.`);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not save the student record.');
                  }
                }}
              >
                Student record
              </Button>
              <Button type="button" variant="ghost" onClick={() => setFilesOpen(true)}>
                {viewingFileCount ? `View files (${viewingFileCount})` : 'View files'}
              </Button>
              {!isStudentHereToday(store, viewing.studentId) ? (
                <Button type="button" variant="ghost" disabled={busy} onClick={() => void markHereToday(viewing)}>
                  Here today
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={() => {
                  setFilesOpen(false);
                  setOpenId(null);
                  openEditor(viewing);
                }}
              >
                Edit
              </Button>
            </div>
          }
        >
          <ProfileFact label="Sessions left">{sessionLeftLabel(store, viewing.studentId)}</ProfileFact>
          <ProfileFact label="Remaining balance">{paymentBalanceLabel(store, viewing.studentId)}</ProfileFact>
          <ProfileFact label="Student number">{assigned(viewing.studentId)}</ProfileFact>
          <ProfileFact label="Parent / guardian">{assigned(viewingParent ? displayName(viewingParent) : '')}</ProfileFact>
          <ProfileFact label="Program">{assigned(viewingPlace?.programName || viewing.program)}</ProfileFact>
          <ProfileFact label="Class">{assigned(viewingPlace?.className)}</ProfileFact>
          <ProfileFact label="Assigned teacher">{assigned(viewingPlace?.teacherName)}</ProfileFact>
          <ProfileFact label="Today">
            {assigned(
              isStudentHereToday(store, viewing.studentId)
                ? studentDayAttendance(store, viewing.studentId)?.status || 'present'
                : studentDayAttendance(store, viewing.studentId)?.status,
            )}
          </ProfileFact>
          <ProfileFact label="Contact">{assigned(viewing.contactNumber)}</ProfileFact>
        </ProfileModal>
      ) : null}
      {viewing && filesOpen ? (
        <DeskModal
          title={`Files · ${studentDisplay(viewing)}`}
          size="wide"
          stacked
          onClose={() => setFilesOpen(false)}
          actions={
            <Button type="button" variant="ghost" onClick={() => setFilesOpen(false)}>
              Back to profile
            </Button>
          }
        >
          <StudentFilesPanel studentId={viewing.studentId} store={store} onStore={onStore} canEdit />
        </DeskModal>
      ) : null}
      {editing ? (
        <EditorModal
          title={current ? `Edit ${studentDisplay(current)}` : 'Add student'}
          error={error}
          busy={busy}
          submitLabel={current ? 'Save student' : 'Create student'}
          onClose={() => {
            setEditing(null);
            setAddingProgram(false);
          }}
          onSubmit={onSubmit}
        >
          <FormSection title="Profile photo">
            <ProfilePhotoField
              kind="student"
              userId={current?.studentId}
              hasPhoto={Boolean(current?.profileImagePath)}
              cacheKey={current?.profileImagePath}
            />
          </FormSection>
          <FormSection title="Student info">
            <Field label="Last name" required>
              <Input name="lastName" defaultValue={current?.lastName} required />
            </Field>
            <Field label="First name" required>
              <Input name="firstName" defaultValue={current?.firstName} required />
            </Field>
            <Field label="Middle name" optional>
              <Input name="middleName" defaultValue={current?.middleName} />
            </Field>
            <Field label="Student number" optional hint="Assigned automatically on save if empty.">
              <Input value={current?.studentId || 'Assigned on save'} readOnly />
            </Field>
            <Field label="Boy / Girl" optional>
              <Select name="gender" defaultValue={current?.gender || ''}>
                <option value="">Not provided</option>
                <option value="male">Boy</option>
                <option value="female">Girl</option>
              </Select>
            </Field>
            <Field label="Birthday" optional>
              <Input name="birthdate" type="date" defaultValue={current?.birthdate} />
            </Field>
            <Field label="Address" optional>
              <Input name="address" defaultValue={current?.address} />
            </Field>
            <Field label="Contact number" optional>
              <Input name="contactNumber" defaultValue={current?.contactNumber} />
            </Field>
          </FormSection>
          <FormSection title="Placement">
            <Field label="Slot" optional>
              <Input name="slot" defaultValue={store.studentOps.find((item) => item.studentId === current?.studentId)?.currentSlot || ''} />
            </Field>
            <Field
              label="Program"
              optional
              hint="Sets this learner’s lane. Parent management and Session management follow this same program."
            >
              <ProgramSpecialtySelect name="specialty" value={programChoice || current?.program || lane || ''} store={store} />
            </Field>
            <Field label="Sessions left" optional hint="Saved on this student’s package. Marking Here today uses one session.">
              <Input
                name="sessionsRemaining"
                type="number"
                min={0}
                defaultValue={editorSessions.hasPackage ? editorSessions.remaining : ''}
                placeholder="10"
              />
            </Field>
            <Field label="Sessions in package" optional>
              <Input
                name="sessionsTotal"
                type="number"
                min={0}
                defaultValue={editorSessions.hasPackage ? editorSessions.total : ''}
                placeholder="10"
              />
            </Field>
            <Field label="Tuition fee" optional hint="Total amount required. Remaining balance is this fee minus total paid.">
              <Input
                name="paymentBalance"
                type="number"
                min={0}
                step="0.01"
                defaultValue={studentTuitionFee(store, current?.studentId || '')}
                placeholder="0"
              />
            </Field>
            <Field label="Payment status" optional hint="Calculated from tuition fee and total paid.">
              <Input value={editorBill.status === 'paid' ? 'Paid' : editorBill.status === 'partial' ? 'Partial' : 'Unpaid'} readOnly />
            </Field>
            <Field label="Parent / guardian" required>
              <Select name="parentId" defaultValue={current?.parentId || ''} required>
                <option value="">Select parent</option>
                {parentOptions(store).map((parent) => (
                  <option key={parent.userId} value={parent.userId}>
                    {displayName(parent)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Student status">
              <Select name="status" defaultValue={current?.status || 'active'}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <div className="form-span">
              <Field label="Notes" optional>
                <Input name="notes" defaultValue={current?.notes} />
              </Field>
            </div>
          </FormSection>
        </EditorModal>
      ) : null}
      {editing && addingProgram ? (
        <DeskModal
          stacked
          title="Add program"
          onClose={() => {
            if (programBusy) return;
            setAddingProgram(false);
            setError(null);
          }}
          actions={
            <>
              <Button type="button" variant="ghost" disabled={programBusy} onClick={() => setAddingProgram(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={programBusy} onClick={() => void saveCustomProgram()}>
                {programBusy ? 'Saving…' : 'Save program'}
              </Button>
            </>
          }
        >
          <p className="hlc-field-hint">This program is added to the center list and selected for this student.</p>
          {error ? (
            <p className="crud-notice crud-notice-error" role="alert">
              {error}
            </p>
          ) : null}
          <Field label="Program name" required>
            <Input
              value={newProgramName}
              onChange={(event) => setNewProgramName(event.target.value)}
              placeholder="e.g. After-school tutorial"
              autoFocus
            />
          </Field>
          <Field label="Description" optional>
            <Input value={newProgramNote} onChange={(event) => setNewProgramNote(event.target.value)} />
          </Field>
        </DeskModal>
      ) : null}
      {messaging ? (
        <DirectMessageModal
          key={store.alerts.length}
          person={messaging}
          actorId={actor?.userId || ''}
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
            if (!onStore) return;
            setBusy(true);
            setError(null);
            try {
              onStore(await api.sendDirectMessage(messaging.userId, body));
              setNotice(`Message sent to ${displayName(messaging)}.`);
              setMessaging(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not send that message.');
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </>
  );
}
