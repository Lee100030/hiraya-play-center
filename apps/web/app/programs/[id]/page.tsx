'use client';

import { PublicChrome } from '@/components/public/PublicChrome';
import { usePublicSite } from '@/hooks/usePublicSite';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { site } = usePublicSite();
  const program = site.programs.find((item) => item.programId === id || encodeURIComponent(item.name) === id);

  return (
    <PublicChrome>
      <p className="eyebrow">Learning</p>
      {program ? (
        <>
          <h1>{program.name}</h1>
          <p>{program.description}</p>
          <article className="info-card" style={{ maxWidth: 560 }}>
            <div className="program-mark">
              <Image src="/images/hiraya-crest.png" alt="" width={28} height={28} />
            </div>
            <h3>What families can expect</h3>
            <p>
              {program.name} at {site.centerName} is designed for children who are ready for this level. Teachers
              share progress with families and keep daily routines predictable and kind.
            </p>
          </article>
        </>
      ) : (
        <>
          <h1>Program details</h1>
          <p>This program is not listed right now. Browse the current offerings instead.</p>
        </>
      )}
      <p style={{ marginTop: 24 }}>
        <Link href="/programs" className="btn-ghost">
          Back to programs
        </Link>
      </p>
    </PublicChrome>
  );
}
