'use client';

import { usePublicSite } from '@/hooks/usePublicSite';
import { api } from '@/lib/api';
import { ageFromBirthdate } from '@/lib/enrollment';
import { Alert, Field, Input, Select, Textarea } from '@hiraya/ui';
import { enrollPublicSchema, teacherApplySchema } from '@hiraya/validation';
import {
  createContext,
  FormEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

type EnrollmentContextValue = {
  open: (program?: string) => void;
  openTeacher: () => void;
  close: () => void;
};

const EnrollmentContext = createContext<EnrollmentContextValue | null>(null);

export function useEnrollment() {
  const ctx = useContext(EnrollmentContext);
  if (!ctx) {
    throw new Error('useEnrollment must be used within EnrollmentProvider');
  }
  return ctx;
}

export function EnrollmentProvider({
  children,
  autoOpen = false,
  initialProgram = '',
}: {
  children: ReactNode;
  autoOpen?: boolean;
  initialProgram?: string;
}) {
  const [visible, setVisible] = useState(autoOpen);
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [program, setProgram] = useState(initialProgram);

  const open = useCallback((next = '') => {
    setTeacherOpen(false);
    setProgram(next);
    setVisible(true);
  }, []);

  const openTeacher = useCallback(() => {
    setVisible(false);
    setTeacherOpen(true);
  }, []);

  const close = useCallback(() => setVisible(false), []);
  const closeTeacher = useCallback(() => setTeacherOpen(false), []);

  useEffect(() => {
    if (autoOpen) {
      setProgram(initialProgram);
      setVisible(true);
    }
  }, [autoOpen, initialProgram]);

  return (
    <EnrollmentContext.Provider value={{ open, openTeacher, close }}>
      {children}
      <EnrollmentModal open={visible} program={program} onProgramChange={setProgram} onClose={close} />
      <TeacherApplyModal open={teacherOpen} onClose={closeTeacher} />
    </EnrollmentContext.Provider>
  );
}

export function EnrollTrigger({
  children,
  className,
  program = '',
  onClick,
  magnetic = true,
}: {
  children: ReactNode;
  className?: string;
  program?: string;
  onClick?: () => void;
  magnetic?: boolean;
}) {
  const { open } = useEnrollment();
  return (
    <button
      type="button"
      className={className}
      data-magnetic={magnetic ? '' : undefined}
      onClick={() => {
        onClick?.();
        open(program);
      }}
    >
      {children}
    </button>
  );
}

export function TeacherApplyTrigger({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const { openTeacher } = useEnrollment();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        onClick?.();
        openTeacher();
      }}
    >
      {children}
    </button>
  );
}

function EnrollmentModal({
  open,
  program,
  onProgramChange,
  onClose,
}: {
  open: boolean;
  program: string;
  onProgramChange: (value: string) => void;
  onClose: () => void;
}) {
  const { site } = usePublicSite();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [ok, setOk] = useState(false);
  const [applicationId, setApplicationId] = useState('');
  const [receiptSchedule, setReceiptSchedule] = useState('');
  const [saving, setSaving] = useState(false);
  const [age, setAge] = useState('');
  const year = new Date().getFullYear();
  const term = `${year}–${year + 1}`;
  const selected = useMemo(
    () => site.programs.find((item) => item.name === program),
    [program, site.programs],
  );

  useEffect(() => {
    if (!open) {
      setError(null);
      setFieldErrors({});
      setOk(false);
      setApplicationId('');
      setReceiptSchedule('');
      setSaving(false);
      setAge('');
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLInputElement | HTMLButtonElement>('input, button')?.focus();
    }, 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, saving]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    const form = event.currentTarget;
    const parsed = enrollPublicSchema.safeParse(Object.fromEntries(new FormData(form).entries()));
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] || '');
        if (key && !next[key]) next[key] = issue.message;
      }
      setFieldErrors(next);
      setError('Please complete the required fields.');
      return;
    }
    setFieldErrors({});
    setSaving(true);
    const payload = {
      ...parsed.data,
      studentAge: parsed.data.studentAge ?? Number(ageFromBirthdate(parsed.data.studentBirthdate) || 0),
      studentBirthdate: parsed.data.studentBirthdate,
      studentGender: parsed.data.studentGender,
      studentEmail: parsed.data.studentEmail || '',
      notes: parsed.data.notes || '',
    };
    try {
      const result = await api.applyEnrollment(payload);
      setApplicationId(result.applicationId || '');
      setReceiptSchedule(payload.preferredSchedule || '');
      setOk(true);
      form.reset();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      setError(
        /mysql/i.test(raw)
          ? 'This email is already used at this center. Use a different parent email.'
          : raw || 'Could not submit enrollment to HIRAYA. Make sure the API is running.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="enroll-overlay"
      role="presentation"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="enroll-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="enroll-modal-close" onClick={onClose} aria-label="Close application">
          ×
        </button>
        <header className="enroll-modal-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hiraya-crest.png" alt="" width={44} height={44} />
          <p className="enroll-modal-kicker">Admissions · School Year {term}</p>
          <h2 id={titleId}>Online Application</h2>
          <p className="enroll-modal-school">{site.centerName || 'HIRAYA Kids Learning Center'}</p>
          <ol className="enroll-progress" aria-label="Application steps">
            <li className={program || ok ? 'done' : 'current'}>1 · Program</li>
            <li className={ok ? 'done' : program ? 'current' : ''}>2 · Family details</li>
            <li className={ok ? 'current' : ''}>3 · Received</li>
          </ol>
          {program ? <p className="enroll-modal-course">Applying for {program}</p> : null}
          {selected?.description ? <p className="enroll-modal-course-copy">{selected.description}</p> : null}
        </header>

        {ok ? (
          <div className="enroll-modal-success">
            <Alert kind="success">
              Your application was received. We will notify you by email for the next process.
            </Alert>
            <ul className="enroll-next-steps">
              <li>
                <strong>Email</strong>
                The next process will be sent to the parent or guardian email on file.
              </li>
              <li>
                <strong>Schedule</strong>
                {receiptSchedule || selected?.description || site.businessHours || 'The office will confirm your class schedule.'}
              </li>
              <li>
                <strong>Location</strong>
                Hiraya Kids Learning Center, {site.address || 'Rodriguez (Montalban), Rizal, Philippines'}
              </li>
              {applicationId ? (
                <li>
                  <strong>Reference</strong>
                  {applicationId}
                </li>
              ) : null}
            </ul>
            {error ? <Alert>{error}</Alert> : null}
            <button type="button" className="enroll-modal-submit" onClick={onClose}>
              Close
            </button>
          </div>
        ) : !program ? (
          <div className="enroll-modal-form">
            <p className="enroll-modal-section">Choose a program</p>
            <p className="enroll-modal-note">Select a course to continue the application.</p>
            <div className="enroll-program-list">
              {site.programs.map((item) => (
                <button
                  key={item.programId || item.name}
                  type="button"
                  className="enroll-program-choice"
                  onClick={() => onProgramChange(item.name)}
                >
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form className="enroll-modal-form" onSubmit={onSubmit} noValidate>
            {error ? <Alert>{error}</Alert> : null}

            <p className="enroll-modal-section">Learner</p>
            <div className="enroll-modal-grid">
              <Field label="Student full name" required error={fieldErrors.studentFullname}>
                <Input name="studentFullname" autoComplete="name" required />
              </Field>
              <Field label="Date of birth" required error={fieldErrors.studentBirthdate}>
                <Input
                  name="studentBirthdate"
                  type="date"
                  required
                  onChange={(event) => setAge(ageFromBirthdate(event.target.value))}
                />
              </Field>
              <Field label="Age" error={fieldErrors.studentAge}>
                <Input name="studentAge" type="number" min={0} max={18} value={age} readOnly />
              </Field>
              <Field label="Gender" required error={fieldErrors.studentGender}>
                <Select name="studentGender" defaultValue="" required>
                  <option value="">Select</option>
                  <option>Female</option>
                  <option>Male</option>
                </Select>
              </Field>
              <Field label="Address" required error={fieldErrors.studentAddress}>
                <Input name="studentAddress" autoComplete="street-address" required />
              </Field>
              <Field label="Contact number" required error={fieldErrors.studentPhone}>
                <Input name="studentPhone" inputMode="tel" required />
              </Field>
              <Field label="Email address" error={fieldErrors.studentEmail}>
                <Input name="studentEmail" type="email" autoComplete="email" />
              </Field>
            </div>

            <p className="enroll-modal-section">Parent / guardian</p>
            <div className="enroll-modal-grid">
              <Field label="Parent or guardian full name" required error={fieldErrors.parentFullname}>
                <Input name="parentFullname" required />
              </Field>
              <Field label="Parent contact number" required error={fieldErrors.parentPhone}>
                <Input name="parentPhone" inputMode="tel" required />
              </Field>
              <Field label="Relationship to student" required error={fieldErrors.guardianRelationship}>
                <Select name="guardianRelationship" defaultValue="" required>
                  <option value="">Select</option>
                  <option>Mother</option>
                  <option>Father</option>
                  <option>Guardian</option>
                  <option>Other</option>
                </Select>
              </Field>
              <Field label="Parent email" required error={fieldErrors.parentEmail}>
                <Input name="parentEmail" type="email" autoComplete="email" required />
              </Field>
            </div>

            <p className="enroll-modal-section">Enrollment</p>
            <div className="enroll-modal-grid">
              <Field label="Selected program" required error={fieldErrors.preferredProgram}>
                {site.programs.length ? (
                  <Select name="preferredProgram" defaultValue={program} key={program} required>
                    <option value="">Select a program</option>
                    {site.programs.map((item) => (
                      <option key={item.programId} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input name="preferredProgram" required defaultValue={program} />
                )}
              </Field>
              <Field label="Preferred schedule" required error={fieldErrors.preferredSchedule}>
                <Select name="preferredSchedule" defaultValue="" required>
                  <option value="">Select</option>
                  <option>Morning</option>
                  <option>Afternoon</option>
                  <option>Whole day</option>
                </Select>
              </Field>
              <Field label="Enrollment type" required error={fieldErrors.enrollmentType}>
                <Select name="enrollmentType" defaultValue="" required>
                  <option value="">Select</option>
                  <option>New student</option>
                  <option>Returning student</option>
                  <option>Transfer</option>
                </Select>
              </Field>
              <Field label="Additional notes or concerns" error={fieldErrors.notes}>
                <Textarea name="notes" rows={3} />
              </Field>
            </div>

            <p className="enroll-modal-note">
              By submitting, you confirm that the information is accurate and that the center may use it to process this
              application, following our admissions privacy notice.
            </p>

            <div className="enroll-modal-actions">
              <button type="button" className="enroll-modal-cancel" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="enroll-modal-submit" disabled={saving}>
                {saving ? 'Sending application…' : 'Send application'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const fallbackTeacherRoles = ['Playgroup', 'Pre-Kinder', 'Kinder', 'ABA', 'Tutorial', 'Any program'];

function TeacherApplyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { site } = usePublicSite();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [ok, setOk] = useState(false);
  const [applicationId, setApplicationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const roles = site.programs.length ? [...site.programs.map((item) => item.name), 'Any program'] : fallbackTeacherRoles;

  useEffect(() => {
    if (!open) {
      setError(null);
      setFieldErrors({});
      setOk(false);
      setApplicationId('');
      setSaving(false);
      setCopied(false);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => {
      if (!ok) panelRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    }, 40);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, saving]);

  useEffect(() => {
    if (!open || !ok) return;
    const t = window.setTimeout(() => doneRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open, ok]);

  async function copyReference() {
    if (!applicationId) return;
    try {
      await navigator.clipboard.writeText(applicationId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const resume = data.get('resume');
    const parsed = teacherApplySchema.safeParse({
      fullname: data.get('fullname'),
      email: data.get('email'),
      phone: data.get('phone'),
      position: data.get('position'),
      notes: data.get('notes'),
    });
    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] || '');
        if (key && !next[key]) next[key] = issue.message;
      }
    }
    if (!(resume instanceof File) || resume.size <= 0) {
      next.resume = 'Upload your resume as a PDF or Word file.';
    } else if (!/\.(pdf|doc|docx)$/i.test(resume.name)) {
      next.resume = 'Resume must be a PDF or Word file.';
    } else if (resume.size > 5 * 1024 * 1024) {
      next.resume = 'Resume must be 5 MB or smaller.';
    }
    if (!parsed.success || !(resume instanceof File) || next.resume) {
      setFieldErrors(next);
      setError('Please complete the required fields.');
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const result = await api.applyTeacher({
        fullname: parsed.data.fullname,
        email: parsed.data.email,
        phone: parsed.data.phone,
        position: parsed.data.position,
        notes: parsed.data.notes || '',
        resume,
        resumeName: resume.name,
      });
      setApplicationId(result.applicationId || '');
      setOk(true);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the teacher application.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="enroll-overlay"
      role="presentation"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className={ok ? 'enroll-modal is-teacher-success' : 'enroll-modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="enroll-modal-close" onClick={onClose} aria-label="Close teacher application">
          ×
        </button>
        <header className="enroll-modal-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hiraya-crest.png" alt="" width={44} height={44} />
          <p className="enroll-modal-kicker">Careers · Teaching</p>
          {ok ? (
            <div className="teacher-success-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="32" height="32">
                <path d="M6.2 12.4 10 16.2 17.8 7.8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ) : null}
          <h2 id={titleId}>{ok ? 'Application submitted' : 'Apply for a teacher'}</h2>
          <p className="enroll-modal-school">{site.centerName || 'HIRAYA Kids Learning Center'}</p>
        </header>
        {ok ? (
          <div className="enroll-modal-success teacher-apply-success" role="status" aria-live="polite">
            <p className="teacher-success-lead">Your application has been submitted successfully.</p>
            <p className="teacher-success-note">
              Please wait for admin approval. We will contact you through your email once your application has been reviewed.
            </p>
            {applicationId ? (
              <div className="teacher-ref">
                <p className="teacher-ref-label">Reference number</p>
                <div className="teacher-ref-row">
                  <code className="teacher-ref-code">{applicationId}</code>
                  <button type="button" className="teacher-ref-copy" onClick={() => void copyReference()}>
                    {copied ? 'Copied ✓' : 'Copy'}
                  </button>
                </div>
              </div>
            ) : null}
            <button ref={doneRef} type="button" className="enroll-modal-submit teacher-success-done" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form className="enroll-modal-form" onSubmit={onSubmit} noValidate>
            {error ? <Alert>{error}</Alert> : null}
            <p className="enroll-modal-section">Your details</p>
            <p className="enroll-modal-note">This form is for people who want to teach. It does not enroll a child.</p>
            <div className="enroll-modal-grid">
              <Field label="Full name" required error={fieldErrors.fullname}>
                <Input name="fullname" autoComplete="name" required />
              </Field>
              <Field label="Email" required error={fieldErrors.email}>
                <Input name="email" type="email" autoComplete="email" required />
              </Field>
              <Field label="Contact number" required error={fieldErrors.phone}>
                <Input name="phone" inputMode="tel" autoComplete="tel" required />
              </Field>
              <Field label="Role you want to teach" required error={fieldErrors.position}>
                <Select name="position" defaultValue="" required>
                  <option value="">Select</option>
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Experience and message" error={fieldErrors.notes}>
                <Textarea name="notes" rows={4} />
              </Field>
              <div className="enroll-file">
                <Field
                  label="Resume"
                  required
                  error={fieldErrors.resume}
                  hint="PDF or Word, up to 5 MB. The administrator can open this file."
                >
                  <input
                    name="resume"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    required
                  />
                </Field>
              </div>
            </div>
            <div className="enroll-modal-actions">
              <button type="button" className="enroll-modal-cancel" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="enroll-modal-submit" disabled={saving}>
                {saving ? 'Sending application…' : 'Apply now'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
