'use client';

import { PublicChrome } from '@/components/public/PublicChrome';
import { ProgramsSection } from '@/components/public/ProgramsSection';
import { usePublicSite } from '@/hooks/usePublicSite';

export default function ProgramsPage() {
  const { site } = usePublicSite();
  return (
    <PublicChrome>
      <ProgramsSection site={site} />
    </PublicChrome>
  );
}
