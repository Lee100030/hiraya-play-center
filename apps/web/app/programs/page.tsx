'use client';

import { PublicChrome } from '@/components/public/PublicChrome';
import { ProgramsSection } from '@/components/public/ProgramsSection';
import { usePublicSite } from '@/hooks/usePublicSite';

export default function ProgramsPage() {
  const { site, loading } = usePublicSite();
  return (
    <PublicChrome>
      <ProgramsSection site={site} standalone loading={loading} />
    </PublicChrome>
  );
}
