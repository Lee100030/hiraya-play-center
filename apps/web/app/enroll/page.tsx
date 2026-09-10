'use client';

import { PublicChrome } from '@/components/public/PublicChrome';
import { EnrollTrigger } from '@/components/public/enrollment';
import { usePublicSite } from '@/hooks/usePublicSite';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AdmissionsPage() {
  const search = useSearchParams();
  const { site } = usePublicSite();
  const program = search.get('program') || '';
  const year = new Date().getFullYear();

  return (
    <PublicChrome autoEnroll enrollProgram={program}>
      <p className="eyebrow">Admissions</p>
      <h1>Online application</h1>
      <p>
        Families may apply to {site.centerName || 'HIRAYA'} for School Year {year}–{year + 1}. Complete the
        short application form — the same process used by many Philippine schools for first-stage admissions.
      </p>
      <p>
        <EnrollTrigger className="btn-hero">Open application form</EnrollTrigger>
      </p>
    </PublicChrome>
  );
}

export default function EnrollPage() {
  return (
    <Suspense>
      <AdmissionsPage />
    </Suspense>
  );
}
