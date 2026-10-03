'use client';

import { EnrollTrigger } from '@/components/public/enrollment';
import { CloseIcon } from '@/components/public/icons';
import type { PublicProgram } from '@hiraya/types';
import { useEffect, useId, useRef } from 'react';

export function ProgramDetailModal({ program, onClose }: { program: PublicProgram; onClose: () => void }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus(), 40);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="enroll-overlay" role="presentation" onClick={onClose}>
      <div
        className="enroll-modal program-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="enroll-modal-close" onClick={onClose} aria-label="Close program details">
          <CloseIcon width={22} height={22} />
        </button>
        <header className="enroll-modal-head">
          <p className="enroll-modal-kicker">Learning</p>
          <h2 id={titleId}>{program.name}</h2>
        </header>
        <div className="program-modal-body">
          <p>{program.description}</p>
          <div className="program-modal-actions">
            <button type="button" className="enroll-modal-cancel" onClick={onClose}>
              Close
            </button>
            <EnrollTrigger className="enroll-modal-submit" program={program.name} magnetic={false}>
              Apply
            </EnrollTrigger>
          </div>
        </div>
      </div>
    </div>
  );
}
