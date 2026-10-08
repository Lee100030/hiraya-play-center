'use client';

import { AdminProfileFact, AdminProfileModal } from '@/components/admin/AdminProfileModal';
import { StudentFilesPanel } from '@/components/admin/StudentFilesPanel';
import { LaneSessionPackage } from '@/components/admin/LaneSessionPackage';
import { AdminModal } from '@/components/admin/AdminModal';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminTable } from '@/components/admin/AdminTable';
import { useAuth } from '@/components/AuthProvider';
import { useStore } from '@/components/StoreProvider';
import { api } from '@/lib/api';
import { ProfilePhotoField, saveStudentPhoto } from '@/components/admin/ProfilePhotoField';
import { Button, EmptyState, EmptyValue, Field, FieldLegend, Input, Loading, PersonAvatar, ProgramSpecialtySelect, Select, StatusBadge, Textarea, emptyCell } from '@hiraya/ui';
import { addLearningProgram, compareStudentNames, confirmStudentPresentToday, downloadStudentRecord, isStudentHereToday, laneLabel, newId, parsePeopleLane, paymentBalanceLabel, removeStudentLinkedRecords, resolveStudentProgramValue, sessionLeftFor, sessionLeftLabel, studentDayAttendance, studentDisplay, studentInLane, studentPaymentBalance, studentTuitionFee, upsertStudentBalance, upsertStudentSessions } from '@hiraya/utils';
import type { Student } from '@hiraya/types';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function blankStudent(): Student {
  return {
    studentId: '',
    firstName: '',
    middleName: '',
    lastName: '',
    fullname: '',
    birthdate: '',
    age: 0,
    gender: '',
    address: '',
    contactNumber: '',
    parentId: '',
    emergencyContact: '',
    emergencyPhone: '',
    qrCode: '',
    gradeLevel: '',
    program: '',
    status: 'active',
    enrollmentDate: new Date().toISOString().slice(0, 10),
    notes: '',
    profileImagePath: '',
  };
}

export default function AdminStudentsPage() {
  const { user } = useAuth();
  const { store, loading, save, refresh } = useStore();
  const lane = parsePeopleLane(useSearchParams().get('lane'), store);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'view' | 'edit' | 'delete' | null>(null);
  const [filesOpen, setFilesOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [current, setCurrent] = useState<Student | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [programChoice, setProgramChoice] = useState('');
  const [addingProgram, setAddingProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramNote, setNewProgramNote] = useState('');
  const [programBusy, setProgramBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setQuery(q);
  }, []);

  const parents = store.users.filter((user) => user.role === 'parent');

  const rows = useMemo(
    () =>
      store.students
        .filter((student) => {
          const parent = parents.find((item) => item.userId === student.parentId);
          const hay = `${studentDisplay(student)} ${student.gradeLevel} ${student.program} ${student.emergencyContact} ${parent?.fullname || ''}`.toLowerCase();
          return studentInLane(store, student, lane) && hay.includes(query.toLowerCase());
        })
        .sort(compareStudentNames),
    [store, parents, query, lane],
  );

  function guardianText(student: Student) {
    const parent = parents.find((item) => item.userId === student.parentId);
    return parent?.fullname || student.emergencyContact || '';
  }

  function studentPhoto(row?: Student | null) {
    if (!row?.profileImagePath) return undefined;
    return api.studentPhotoUrl(row.studentId, row.profileImagePath);
  }

  // Profile-dialog uploads stay on this helper. The student form uses the imported saveStudentPhoto.
  async function uploadPickedStudentPhoto(row: Student, file: File) {
    setPhotoBusy(true);
    try {
      const next = await api.uploadStudentPhoto(row.studentId, file, file.name || 'photo.jpg');
      await save(next);
      setCurrent(next.students.find((item) => item.studentId === row.studentId) || row);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not save that photo.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function clearStudentPhoto(row: Student) {
    if (!window.confirm(`Remove the photo for ${studentDisplay(row)}?`)) return;
    setPhotoBusy(true);
    try {
      const next = await api.removeStudentPhoto(row.studentId);
      await save(next);
      setCurrent(next.students.find((item) => item.studentId === row.studentId) || { ...row, profileImagePath: '' });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not remove that photo.');
    } finally {
      setPhotoBusy(false);
    }
  }

  function open(next: Student | null, nextMode: 'view' | 'edit' | 'delete') {
    setFilesOpen(false);
    setAddingProgram(false);
    setNewProgramName('');
    setNewProgramNote('');
    const student = next || blankStudent();
    setProgramChoice(student.program || '');
    setCurrent(student);
    setMode(nextMode);
  }

  async function saveCustomProgram() {
    setProgramBusy(true);
    try {
      const result = addLearningProgram(store, newProgramName, newProgramNote);
      if (result.created) await save(result.store);
      setProgramChoice(result.program.name);
      setAddingProgram(false);
      setNewProgramName('');
      setNewProgramNote('');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not add that program.');
    } finally {
      setProgramBusy(false);
    }
  }

  async function markHereToday(row: Student) {
    if (isStudentHereToday(store, row.studentId)) {
      window.alert(`${studentDisplay(row)} is already marked as here today.`);
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
    setBusyId(row.studentId);
    try {
      await save(confirmStudentPresentToday(store, row.studentId, user?.userId || ''));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not record attendance');
    } finally {
      setBusyId(null);
    }
  }

  function todayCell(row: Student) {
    const today = studentDayAttendance(store, row.studentId);
    if (isStudentHereToday(store, row.studentId)) {
      return <StatusBadge status={today?.status || 'present'} />;
    }
    if (today?.status) return <StatusBadge status={today.status} />;
    return (
      <button type="button" className="table-action" disabled={busyId === row.studentId} onClick={() => void markHereToday(row)}>
        Here today
      </button>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const form = new FormData(event.currentTarget);
    const next: Student = {
      ...current,
      studentId: current.studentId || newId('stu'),
      firstName: String(form.get('firstName') || ''),
      middleName: String(form.get('middleName') || ''),
      lastName: String(form.get('lastName') || ''),
      birthdate: String(form.get('birthdate') || ''),
      age: Number(form.get('age') || 0),
      gender: String(form.get('gender') || ''),
      contactNumber: String(form.get('contactNumber') || ''),
      emergencyContact: String(form.get('emergencyContact') || ''),
      gradeLevel: resolveStudentProgramValue(String(form.get('specialty') || form.get('gradeLevel') || form.get('program') || programChoice || ''), store),
      program: resolveStudentProgramValue(String(form.get('specialty') || form.get('program') || programChoice || ''), store),
      status: String(form.get('status') || 'active'),
      notes: String(form.get('notes') || ''),
      parentId: String(form.get('parentId') || current.parentId || ''),
    };
    next.fullname = [next.firstName, next.middleName, next.lastName].filter(Boolean).join(' ');
    try {
      if (!next.parentId) {
        throw new Error('Link a parent account. Children do not sign in; parents use the app.');
      }
    const now = new Date().toISOString();
    let working = store;
    if (next.program) {
      const ensured = addLearningProgram(working, next.program);
      working = ensured.store;
    }
    const existingLink = working.parentStudents.find((l) => l.parentId === next.parentId && l.studentId === next.studentId);
    const parentStudents = [
      ...working.parentStudents.filter((l) => !(l.parentId === next.parentId && l.studentId === next.studentId)),
      {
        parentStudentId: existingLink?.parentStudentId || `ps_${Date.now().toString(36)}`,
        parentId: next.parentId,
        studentId: next.studentId,
        relationship: existingLink?.relationship || 'Guardian',
        isActive: true,
        createdAt: existingLink?.createdAt || now,
        updatedAt: now,
      },
    ];
    const students = working.students.some((item) => item.studentId === next.studentId)
      ? working.students.map((item) => (item.studentId === next.studentId ? next : item))
      : [...working.students, next];
    const programId = working.programs.find((item) => item.name === next.program)?.programId || '';
    await save(
      upsertStudentBalance(
        upsertStudentSessions(
          { ...working, students, parentStudents },
          next.studentId,
          String(form.get('sessionsRemaining') || '').trim(),
          String(form.get('sessionsTotal') || '').trim(),
          programId,
        ),
        next.studentId,
        String(form.get('paymentBalance') || '').trim(),
        String(form.get('paymentStatus') || '').trim(),
        user?.userId || '',
      ),
    );
    try {
      await saveStudentPhoto(next.studentId, form, event.currentTarget);
    } catch (photoErr) {
      window.alert(
        photoErr instanceof Error
          ? `Student saved, but the photo did not upload: ${photoErr.message}. Restart the HIRAYA API (port 5188), then edit this student and upload the photo again.`
          : 'Student saved, but the photo did not upload.',
      );
    }
    setMode(null);
    setCurrent(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not save student');
    }
  }

  async function remove() {
    if (!current?.studentId) return;
    if (
      !window.confirm(
        `Delete ${studentDisplay(current)}, related enrollments, session packages, and counted payments? Prefer Archive unless this was added by mistake.`,
      )
    ) {
      return;
    }
    await save(removeStudentLinkedRecords(store, [current.studentId]));
    setMode(null);
    setCurrent(null);
  }

  if (loading) return <Loading />;

  return (
    <>
      <AdminPageHeader
        kicker="Management"
        title={lane ? `Student management · ${laneLabel(lane)}` : 'Student management'}
        description={
          lane
            ? `Learners in ${laneLabel(lane)}.`
            : 'Create learners, link each child to a parent, and mark who is at the center today. Present records attendance and uses one session from the child’s package.'
        }
        actions={
          <button type="button" className="dash-action dash-action-primary" onClick={() => open(blankStudent(), 'edit')}>
            + Add Student
          </button>
        }
      />
      {lane ? <LaneSessionPackage lane={lane} /> : null}
      <div className="admin-filter-bar">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter this list of students" aria-label="Filter this list of students" />
      </div>
      <AdminTable
        rows={rows}
        rowKey={(row) => row.studentId}
        preferCards
        selectable
        onRefresh={() => void refresh()}
        cardName={(row) => studentDisplay(row)}
        empty={<EmptyState title="No students" hint="Add a learner or adjust search." />}
        onRowOpen={(row) => open(row, 'view')}
        columns={[
          { key: 'name', header: 'Name', sortValue: (row) => studentDisplay(row), render: (row) => studentDisplay(row) },
          {
            key: 'grade',
            header: 'Age / Grade',
            sortValue: (row) => row.age || row.gradeLevel,
            render: (row) => [row.age ? `${row.age} yrs` : '', row.gradeLevel].filter(Boolean).join(' · ') || <EmptyValue />,
          },
          { key: 'guardian', header: 'Guardian', sortValue: (row) => guardianText(row), render: (row) => emptyCell(guardianText(row)) },
          { key: 'contact', header: 'Contact', sortValue: (row) => row.contactNumber, render: (row) => emptyCell(row.contactNumber) },
          {
            key: 'today',
            header: 'Today',
            sortValue: (row) => (isStudentHereToday(store, row.studentId) ? 'here' : studentDayAttendance(store, row.studentId)?.status || 'open'),
            render: (row) => todayCell(row),
          },
          {
            key: 'sessions',
            header: 'Sessions left',
            sortValue: (row) => sessionLeftLabel(store, row.studentId),
            render: (row) => emptyCell(sessionLeftLabel(store, row.studentId)),
          },
          {
            key: 'balance',
            header: 'Payment balance',
            sortValue: (row) => paymentBalanceLabel(store, row.studentId),
            render: (row) => emptyCell(paymentBalanceLabel(store, row.studentId)),
          },
          { key: 'status', header: 'Status', sortValue: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'actions',
            header: 'Actions',
            render: (row) => (
              <div className="icon-actions">
                <button type="button" className="icon-btn" aria-label={`View ${studentDisplay(row)}`} onClick={() => open(row, 'view')}>
                  👁
                </button>
                <button type="button" className="icon-btn" aria-label={`Edit ${studentDisplay(row)}`} onClick={() => open(row, 'edit')}>
                  ✎
                </button>
                <button type="button" className="icon-btn danger" aria-label={`Delete ${studentDisplay(row)}`} onClick={() => open(row, 'delete')}>
                  ⌫
                </button>
              </div>
            ),
          },
        ]}
        renderCard={(row) => (
          <article className="people-card">
            <PersonAvatar name={studentDisplay(row)} photo={studentPhoto(row)} size="lg" />
            <h3>{studentDisplay(row)}</h3>
            <p className="people-card-role">Student</p>
            <p className="people-card-stat">
              {[
                row.program || 'Program not set',
                sessionLeftFor(store, row.studentId).hasPackage && `Sessions: ${sessionLeftLabel(store, row.studentId)}`,
                studentPaymentBalance(store, row.studentId).due > 0 && `Balance: ${paymentBalanceLabel(store, row.studentId)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </article>
        )}
      />

      {mode === 'view' && current ? (
        <AdminProfileModal
          title="Student profile"
          name={studentDisplay(current)}
          subtitle={current.program || 'Learner'}
          status={current.status}
          photo={studentPhoto(current)}
          photoEditable
          photoBusy={photoBusy}
          onPickPhoto={(file) => void uploadPickedStudentPhoto(current, file)}
          onRemovePhoto={() => void clearStudentPhoto(current)}
          active={current.status === 'active'}
          onToggleActive={(next) => {
            void save({
              ...store,
              students: store.students.map((item) =>
                item.studentId === current.studentId ? { ...item, status: next ? 'active' : 'inactive' } : item,
              ),
            });
            setCurrent({ ...current, status: next ? 'active' : 'inactive' });
          }}
          onClose={() => {
            setFilesOpen(false);
            setMode(null);
          }}
          actions={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFilesOpen(false);
                  setMode(null);
                }}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  try {
                    downloadStudentRecord(store, current.studentId);
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : 'Could not save the student record.');
                  }
                }}
              >
                Student record
              </Button>
              <Button type="button" variant="ghost" onClick={() => setFilesOpen(true)}>
                {(store.studentDocuments || []).filter((item) => item.studentId === current.studentId).length
                  ? `View files (${(store.studentDocuments || []).filter((item) => item.studentId === current.studentId).length})`
                  : 'View files'}
              </Button>
              {!isStudentHereToday(store, current.studentId) ? (
                <Button type="button" variant="ghost" onClick={() => void markHereToday(current)}>
                  Here today
                </Button>
              ) : null}
              <Button type="button" onClick={() => open(current, 'edit')}>
                Edit
              </Button>
            </>
          }
        >
          <AdminProfileFact label="Sessions left">{sessionLeftLabel(store, current.studentId)}</AdminProfileFact>
          <AdminProfileFact label="Remaining balance">{paymentBalanceLabel(store, current.studentId)}</AdminProfileFact>
          <AdminProfileFact label="Age / grade">
            {[current.age ? `${current.age} yrs` : '', current.gradeLevel].filter(Boolean).join(' · ') || <EmptyValue />}
          </AdminProfileFact>
          <AdminProfileFact label="Program">{emptyCell(current.program)}</AdminProfileFact>
          <AdminProfileFact label="Guardian">{emptyCell(guardianText(current))}</AdminProfileFact>
          <AdminProfileFact label="Contact">{emptyCell(current.contactNumber)}</AdminProfileFact>
          <AdminProfileFact label="Today">
            {emptyCell(
              isStudentHereToday(store, current.studentId)
                ? 'Here'
                : studentDayAttendance(store, current.studentId)?.status,
            )}
          </AdminProfileFact>
        </AdminProfileModal>
      ) : null}
      {mode === 'view' && current && filesOpen ? (
        <AdminModal
          stacked
          size="lg"
          title={`Files · ${studentDisplay(current)}`}
          description="Birth certificate, medical records, and other documents for this learner."
          onClose={() => setFilesOpen(false)}
          footer={
            <Button type="button" variant="ghost" onClick={() => setFilesOpen(false)}>
              Back to profile
            </Button>
          }
        >
          <StudentFilesPanel studentId={current.studentId} store={store} onStore={(next) => void save(next)} />
        </AdminModal>
      ) : null}

      {mode === 'edit' && current ? (
        <AdminModal
          title={current.studentId ? `Edit ${studentDisplay(current)}` : 'Add student'}
          onClose={() => setMode(null)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button type="submit" form="student-form">
                Save
              </Button>
            </>
          }
        >
          <form id="student-form" className="form-grid" encType="multipart/form-data" onSubmit={onSubmit}>
            <FieldLegend />
            <div className="form-span">
              <ProfilePhotoField
                kind="student"
                userId={current.studentId || undefined}
                hasPhoto={Boolean(current.profileImagePath)}
                cacheKey={current.profileImagePath}
              />
            </div>
            <Field label="First name" required>
              <Input name="firstName" defaultValue={current.firstName} required />
            </Field>
            <Field label="Middle name" optional>
              <Input name="middleName" defaultValue={current.middleName} />
            </Field>
            <Field label="Last name" required>
              <Input name="lastName" defaultValue={current.lastName} required />
            </Field>
            <Field label="Birthdate" optional>
              <Input name="birthdate" type="date" defaultValue={current.birthdate} />
            </Field>
            <Field label="Age" optional>
              <Input name="age" type="number" defaultValue={current.age || 0} />
            </Field>
            <Field label="Program" optional hint="Sets this learner’s lane. Parent management and Session management follow this same program.">
              <ProgramSpecialtySelect name="specialty" value={programChoice || current.program || lane || ''} store={store} />
            </Field>
            <Field label="Sessions left" optional>
              <Input
                name="sessionsRemaining"
                type="number"
                min={0}
                defaultValue={sessionLeftFor(store, current.studentId).hasPackage ? sessionLeftFor(store, current.studentId).remaining : ''}
                placeholder="0"
              />
            </Field>
            <Field label="Sessions in package" optional>
              <Input
                name="sessionsTotal"
                type="number"
                min={0}
                defaultValue={sessionLeftFor(store, current.studentId).hasPackage ? sessionLeftFor(store, current.studentId).total : ''}
                placeholder="0"
              />
            </Field>
            <Field label="Tuition fee" optional hint="Total amount required. Remaining balance is this fee minus total paid.">
              <Input
                name="paymentBalance"
                type="number"
                min={0}
                step="0.01"
                defaultValue={studentTuitionFee(store, current.studentId)}
                placeholder="0"
              />
            </Field>
            <Field label="Payment status" optional hint="Calculated from tuition fee and total paid.">
              <Input
                readOnly
                value={
                  studentPaymentBalance(store, current.studentId).status === 'paid'
                    ? 'Paid'
                    : studentPaymentBalance(store, current.studentId).status === 'partial'
                      ? 'Partial'
                      : 'Unpaid'
                }
              />
            </Field>
            <Field label="Parent / guardian" optional>
              <Select name="parentId" defaultValue={current.parentId}>
                <option value="">Not assigned</option>
                {parents.map((parent) => (
                  <option key={parent.userId} value={parent.userId}>
                    {parent.fullname || parent.email}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Guardian name (if not linked)">
              <Input name="emergencyContact" defaultValue={current.emergencyContact} />
            </Field>
            <Field label="Contact">
              <Input name="contactNumber" defaultValue={current.contactNumber} />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={current.status || 'active'}>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea name="notes" defaultValue={current.notes} />
            </Field>
          </form>
        </AdminModal>
      ) : null}

      {mode === 'edit' && current && addingProgram ? (
        <AdminModal
          stacked
          title="Add program"
          description="This program is added to the center list and selected for this student."
          onClose={() => {
            if (programBusy) return;
            setAddingProgram(false);
          }}
          footer={
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
        </AdminModal>
      ) : null}

      {mode === 'delete' && current ? (
        <AdminModal
          title="Delete student"
          description={`Remove ${studentDisplay(current)} from the roster?`}
          onClose={() => setMode(null)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={() => void remove()}>
                Delete
              </Button>
            </>
          }
        >
          <p>This removes the learner record from the center database.</p>
        </AdminModal>
      ) : null}
    </>
  );
}
