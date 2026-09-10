'use client';

import { usePublicSite } from '@/hooks/usePublicSite';
import { api } from '@/lib/api';
import { Alert, Field, Input, Select } from '@hiraya/ui';
import { enrollPublicSchema } from '@hiraya/validation';
import {
  createContext,
  FormEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
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
      <EnrollmentModal open={visible} program={program} onClose={close} />
    </EnrollmentContext.Provider>
  );
}

export function EnrollTrigger({
  children,
  className,
  program = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  program?: string;
  onClick?: () => void;
}) {
  const { open } = useEnrollment();
  return (
    <button
      type="button"
      className={className}
      data-magnetic
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
  onClose,
}: {
  open: boolean;
  program: string;
  onClose: () => void;
}) {
  const { site } = usePublicSite();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const year = new Date().getFullYear();
  const term = `${year}–${year + 1}`;

  useEffect(() => {
    if (!open) {
      setError(null);
      setOk(false);
      setSaving(false);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    }, 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const parsed = enrollPublicSchema.safeParse(Object.fromEntries(form.entries()));
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Please complete the required fields.');
      return;
    }
    setSaving(true);
    try {
      await api.applyEnrollment({
        ...parsed.data,
        studentAge: parsed.data.studentAge ?? 0,
        studentBirthdate: parsed.data.studentBirthdate ?? '',
        studentGender: parsed.data.studentGender ?? '',
      });
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="enroll-overlay" role="presentation" onClick={onClose}>
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
        </header>

        {ok ? (
          <div className="enroll-modal-success">
            <Alert kind="success">Your application was received. The admissions office will contact the parent or guardian on file.</Alert>
            <button type="button" className="enroll-modal-submit" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form className="enroll-modal-form" onSubmit={onSubmit}>
            {error ? <Alert>{error}</Alert> : null}

            <p className="enroll-modal-section">Learner</p>
            <div className="enroll-modal-grid">
              <Field label="Full legal name">
                <Input name="studentFullname" autoComplete="name" required />
              </Field>
              <Field label="Date of birth">
                <Input name="studentBirthdate" type="date" />
              </Field>
              <Field label="Age">
                <Input name="studentAge" type="number" min={0} max={18} />
              </Field>
              <Field label="Sex">
                <Select name="studentGender" defaultValue="">
                  <option value="">Select</option>
                  <option>Female</option>
                  <option>Male</option>
                </Select>
              </Field>
            </div>

            <p className="enroll-modal-section">Parent / guardian</p>
            <div className="enroll-modal-grid">
              <Field label="Full name">
                <Input name="parentFullname" required />
              </Field>
              <Field label="Email">
                <Input name="parentEmail" type="email" autoComplete="email" required />
              </Field>
              <Field label="Mobile number">
                <Input name="parentPhone" inputMode="tel" required />
              </Field>
              <Field label="Program applied for">
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
            </div>

            <p className="enroll-modal-note">
              By submitting, you confirm that the information is accurate and that the center may use it to process this
              application, following our admissions privacy notice.
            </p>

            <div className="enroll-modal-actions">
              <button type="button" className="enroll-modal-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="enroll-modal-submit" disabled={saving}>
                {saving ? 'Submitting…' : 'Submit application'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
