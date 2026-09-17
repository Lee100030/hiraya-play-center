'use client';

import { usePublicSite } from '@/hooks/usePublicSite';
import { api } from '@/lib/api';
import { ageFromBirthdate } from '@/lib/enrollment';
import { Alert, Field, Input, Select, Textarea } from '@hiraya/ui';
import { enrollPublicSchema } from '@hiraya/validation';
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
  const [program, setProgram] = useState(initialProgram);

  const open = useCallback((next = '') => {
    setProgram(next);
    setVisible(true);
  }, []);

  const close = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (autoOpen) {
      setProgram(initialProgram);
      setVisible(true);
    }
  }, [autoOpen, initialProgram]);

  return (
    <EnrollmentContext.Provider value={{ open, close }}>
      {children}
      <EnrollmentModal open={visible} program={program} onProgramChange={setProgram} onClose={close} />
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
      setOk(true);
      form.reset();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not submit enrollment to HIRAYA. Make sure the API is running.',
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
              Your application was received. The admissions office will contact the parent or guardian on file.
              {applicationId ? ` Reference number: ${applicationId}` : ''}
            </Alert>
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
