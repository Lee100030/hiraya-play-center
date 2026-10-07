import type { Enrollment, EnrollmentApplication, HirayaDatabase, HirayaUser } from '@hiraya/types';
import { formatDate, isTeacherApplication, newId, studentDisplay, teacherApplicationOpen } from '@hiraya/utils';
import { Button, Field, Input, Select } from '@hiraya/ui';
import { FormEvent, useState } from 'react';
import { EditorModal, FormSection } from '../components/EditorModal';
import { RecordTable, StatusCell } from '../components/RecordTable';
import { api } from '../lib/api';
import { ageFromBirthdate, todayIso } from '../lib/crud';
import { PAGE_COPY } from '../lib/views';

export function EnrollmentPage({
  store,
  user,
  saveStore,
  onStore,
  initialKind = 'student',
}: {
  store: HirayaDatabase;
  user: HirayaUser;
  saveStore: (next: HirayaDatabase) => Promise<void>;
  onStore: (next: HirayaDatabase) => void;
  initialKind?: 'student' | 'teacher';
}) {
  const [kind, setKind] = useState<'student' | 'teacher'>(initialKind);
  const [appForm, setAppForm] = useState(false);
  const [seatForm, setSeatForm] = useState(false);
  const [approving, setApproving] = useState<EnrollmentApplication | null>(null);
  const [interviewing, setInterviewing] = useState<EnrollmentApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onApply(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const birthdate = String(form.get('studentBirthdate') || '');
    setBusy(true);
    setError(null);
    try {
      await api.applyEnrollment({
        studentFullname: String(form.get('studentFullname') || ''),
        studentBirthdate: birthdate,
        studentAge: ageFromBirthdate(birthdate),
        studentGender: String(form.get('studentGender') || ''),
        parentFullname: String(form.get('parentFullname') || ''),
        parentEmail: String(form.get('parentEmail') || ''),
        parentPhone: String(form.get('parentPhone') || ''),
        preferredProgram: String(form.get('preferredProgram') || ''),
        notes: String(form.get('notes') || ''),
      });
      onStore(await api.getStore());
      setAppForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit application');
    } finally {
      setBusy(false);
    }
  }

  async function onApprove(event: FormEvent<HTMLFormElement>) {
    if (!approving) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      onStore(await api.approveEnrollment(approving.applicationId, String(form.get('classId') || '') || undefined));
      setApproving(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve application');
    } finally {
      setBusy(false);
    }
  }

  async function onInterview(event: FormEvent<HTMLFormElement>) {
    if (!interviewing) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      onStore(await api.scheduleTeacherInterview(
        interviewing.applicationId,
        String(form.get('when') || ''),
        String(form.get('place') || ''),
        String(form.get('instructions') || ''),
      ));
      setInterviewing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule the interview');
    } finally {
      setBusy(false);
    }
  }

  async function approveTeacher(row: EnrollmentApplication) {
    if (!window.confirm(`Approve ${row.studentFullname} as a teacher? This adds them to Teacher management.`)) return;
    setBusy(true);
    setError(null);
    try {
      onStore(await api.approveEnrollment(row.applicationId));
      try {
        onStore(await api.importApprovedTeachers());
      } catch {
        /* approve already created the teacher when the API supports it */
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not approve the teacher application');
    } finally {
      setBusy(false);
    }
  }

  async function decide(kind: 'reject' | 'cancel', id: string) {
    const label = kind === 'reject' ? 'Reject' : 'Cancel';
    if (!window.confirm(`${label} this enrollment application?`)) return;
    onStore(kind === 'reject' ? await api.rejectEnrollment(id) : await api.cancelEnrollment(id));
  }

  async function removeApplication(row: EnrollmentApplication) {
    if (row.status === 'approved') {
      window.alert('Approved applications stay in history. Remove the class enrollment instead if needed.');
      return;
    }
    if (!window.confirm('Delete this application from the records?')) return;
    await saveStore({
      ...store,
      enrollmentApplications: store.enrollmentApplications.filter((item) => item.applicationId !== row.applicationId),
    });
  }

  async function onSeat(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    const studentId = String(form.get('studentId') || '');
    const classId = String(form.get('classId') || '');
    const cls = store.classes.find((item) => item.classId === classId);
    const next: Enrollment = {
      enrollmentId: newId('enr'),
      studentId,
      classId,
      programId: cls?.programId || '',
      teacherId: cls?.teacherId || '',
      period: String(form.get('period') || ''),
      status: 'active',
      enrollmentDate: todayIso(),
      approvedBy: user.userId,
    };
    const taken = store.enrollments.filter((item) => item.classId === classId && item.status === 'active').length;
    if (cls && cls.capacity > 0 && taken >= cls.capacity) {
      setError(`Class ${cls.name} is at capacity (${cls.capacity}).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveStore({ ...store, enrollments: [...store.enrollments, next] });
      setSeatForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign class');
    } finally {
      setBusy(false);
    }
  }

  async function dropSeat(row: Enrollment) {
    if (!window.confirm('Remove this student from the class?')) return;
    await saveStore({
      ...store,
      enrollments: store.enrollments.filter((item) => item.enrollmentId !== row.enrollmentId),
    });
  }

  return (
    <>
      <RecordTable
        title={kind === 'teacher' ? 'Teacher applications' : PAGE_COPY.enrollment.title}
        description={
          kind === 'teacher'
            ? 'Teacher applications from the public website. Approve adds the person to Teacher management. It does not create a student.'
            : 'Student applications from the website or this desk. Approve creates the student and parent; then assign the learner to a class.'
        }
        rows={store.enrollmentApplications.filter((row) =>
          kind === 'teacher' ? isTeacherApplication(row) : !isTeacherApplication(row),
        )}
        rowKey={(row) => row.applicationId}
        search={(row, q) =>
          `${row.studentFullname} ${row.parentFullname} ${row.parentEmail} ${row.preferredProgram}`.toLowerCase().includes(q)
        }
        searchPlaceholder="Search applications"
        emptyTitle={kind === 'teacher' ? 'No teacher applications' : 'No enrollments found'}
        emptyHint={
          kind === 'teacher'
            ? 'Teacher applications sent from the public website appear here.'
            : 'Submit an application here or from the public website.'
        }
        statusOf={(row) => row.status}
        actions={
          <div className="row-actions">
            <Button type="button" variant={kind === 'student' ? 'primary' : 'ghost'} onClick={() => setKind('student')}>
              Student enrollment
            </Button>
            <Button type="button" variant={kind === 'teacher' ? 'primary' : 'ghost'} onClick={() => setKind('teacher')}>
              Teacher applications
            </Button>
            {kind === 'student' ? (
              <Button type="button" onClick={() => setAppForm(true)}>
                New application
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => setSeatForm(true)}>
              Assign to class
            </Button>
          </div>
        }
        columns={[
          { key: 'student', header: kind === 'teacher' ? 'Applicant' : 'Student', render: (row) => row.studentFullname },
          { key: 'program', header: kind === 'teacher' ? 'Role' : 'Program', render: (row) => row.preferredProgram },
          { key: 'parent', header: kind === 'teacher' ? 'Email' : 'Parent', render: (row) => (kind === 'teacher' ? row.parentEmail : row.parentFullname) },
          { key: 'contact', header: 'Contact', render: (row) => row.parentPhone || row.parentEmail },
          { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
          { key: 'date', header: 'Submitted', render: (row) => formatDate(row.submittedAt) },
          {
            key: 'actions',
            header: '',
            render: (row) => (
              <div className="row-actions">
                {(isTeacherApplication(row) ? teacherApplicationOpen(row.status) : row.status === 'pending_review' || row.status === 'pending') ? (
                  <>
                    {isTeacherApplication(row) && (row.status === 'pending_review' || row.status === 'pending') ? (
                      <Button type="button" variant="ghost" onClick={() => setInterviewing(row)}>
                        Interview
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      onClick={() => {
                        if (isTeacherApplication(row)) void approveTeacher(row);
                        else setApproving(row);
                      }}
                    >
                      Approve
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => void decide('reject', row.applicationId)}>
                      Reject
                    </Button>
                    <Button type="button" variant="danger" onClick={() => void decide('cancel', row.applicationId)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => void removeApplication(row)}>
                    Delete
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Class enrollments</h2>
        <p className="muted">Students already in a class roster.</p>
        <RecordTable
          title=""
          description=""
          rows={store.enrollments}
          rowKey={(row) => row.enrollmentId}
          search={(row, q) => `${row.studentId} ${row.classId} ${row.status}`.toLowerCase().includes(q)}
          searchPlaceholder="Search class seats"
          emptyTitle="No class enrollments"
          emptyHint="Approve an application with a class, or assign an existing student."
          statusOf={(row) => row.status}
          columns={[
            {
              key: 'student',
              header: 'Student',
              render: (row) => {
                const student = store.students.find((item) => item.studentId === row.studentId);
                return student ? studentDisplay(student) : row.studentId;
              },
            },
            {
              key: 'class',
              header: 'Class',
              render: (row) => store.classes.find((item) => item.classId === row.classId)?.name || row.classId,
            },
            { key: 'status', header: 'Status', render: (row) => <StatusCell value={row.status} /> },
            { key: 'date', header: 'Date', render: (row) => formatDate(row.enrollmentDate) },
            {
              key: 'actions',
              header: '',
              render: (row) => (
                <Button type="button" variant="danger" onClick={() => void dropSeat(row)}>
                  Remove
                </Button>
              ),
            },
          ]}
        />
      </section>

      {appForm ? (
        <EditorModal
          title="New enrollment application"
          error={error}
          busy={busy}
          submitLabel="Submit application"
          onClose={() => setAppForm(false)}
          onSubmit={onApply}
        >
          <FormSection title="Child">
            <Field label="Child full name" required>
              <Input name="studentFullname" required />
            </Field>
            <Field label="Birthdate" required>
              <Input name="studentBirthdate" type="date" required />
            </Field>
            <Field label="Gender" optional>
              <Select name="studentGender" defaultValue="">
                <option value="">Select</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </Select>
            </Field>
            <Field label="Program" required>
              <Select name="preferredProgram" required defaultValue="">
                <option value="" disabled>
                  Select program
                </option>
                {store.programs.filter((item) => item.status === 'active').map((program) => (
                  <option key={program.programId} value={program.name}>
                    {program.name}
                  </option>
                ))}
              </Select>
            </Field>
          </FormSection>
          <FormSection title="Parent / guardian">
            <Field label="Parent full name" required>
              <Input name="parentFullname" required />
            </Field>
            <Field label="Parent email" required>
              <Input name="parentEmail" type="email" required />
            </Field>
            <Field label="Parent phone" required>
              <Input name="parentPhone" required />
            </Field>
          </FormSection>
        </EditorModal>
      ) : null}

      {interviewing ? (
        <EditorModal
          title={`Interview for ${interviewing.studentFullname}`}
          error={error}
          busy={busy}
          submitLabel="Schedule interview"
          onClose={() => setInterviewing(null)}
          onSubmit={onInterview}
        >
          <FormSection title="Interview">
            <p className="form-span muted">This tells the applicant the interview time. It does not hire them.</p>
            <Field label="Date and time" required>
              <Input name="when" required placeholder="October 20, 2026, 9:00 AM" />
            </Field>
            <Field label="Location or link" required>
              <Input name="place" required placeholder="Hiraya campus, main office" />
            </Field>
            <Field label="Instructions" optional>
              <Input name="instructions" placeholder="Bring a valid ID." />
            </Field>
          </FormSection>
        </EditorModal>
      ) : null}

      {approving ? (
        <EditorModal
          title={`Approve ${approving.studentFullname}`}
          error={error}
          busy={busy}
          submitLabel="Approve and enroll"
          onClose={() => setApproving(null)}
          onSubmit={onApprove}
        >
          <FormSection title="Placement">
            <p className="form-span muted">
              This creates the student and parent accounts, then places the child in the class you select.
            </p>
            <Field label="Class" optional>
              <Select name="classId" defaultValue="">
                <option value="">Assign class later</option>
                {store.classes
                  .filter((item) => item.status === 'active')
                  .map((item) => (
                    <option key={item.classId} value={item.classId}>
                      {item.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </FormSection>
        </EditorModal>
      ) : null}

      {seatForm ? (
        <EditorModal
          title="Assign student to class"
          error={error}
          busy={busy}
          submitLabel="Assign"
          onClose={() => setSeatForm(false)}
          onSubmit={onSeat}
        >
          <FormSection title="Assignment">
            <Field label="Student" required>
              <Select name="studentId" required defaultValue="">
                <option value="" disabled>
                  Select student
                </option>
                {store.students.map((student) => (
                  <option key={student.studentId} value={student.studentId}>
                    {studentDisplay(student)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Class" required>
              <Select name="classId" required defaultValue="">
                <option value="" disabled>
                  Select class
                </option>
                {store.classes.map((item) => (
                  <option key={item.classId} value={item.classId}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Period" optional>
              <Input name="period" placeholder="e.g. SY 2026" />
            </Field>
          </FormSection>
        </EditorModal>
      ) : null}
    </>
  );
}
