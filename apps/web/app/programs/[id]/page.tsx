'use client';

import { PublicChrome } from '@/components/public/PublicChrome';
import { ProgramDetailModal } from '@/components/public/ProgramDetailModal';
import { ProgramsSection } from '@/components/public/ProgramsSection';
import { usePublicSite } from '@/hooks/usePublicSite';
import { useParams, useRouter } from 'next/navigation';

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { site, loading } = usePublicSite();
  const program = site.programs.find((item) => item.programId === id || encodeURIComponent(item.name) === id);

  return (
    <PublicChrome>
      <ProgramsSection site={site} standalone loading={loading} />
      {program ? <ProgramDetailModal program={program} onClose={() => router.push('/programs')} /> : null}
    </PublicChrome>
  );
}
