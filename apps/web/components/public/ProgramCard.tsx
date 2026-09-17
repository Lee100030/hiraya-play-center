'use client';

import { EnrollTrigger } from '@/components/public/enrollment';
import type { PublicProgram } from '@hiraya/types';
import Image from 'next/image';
import Link from 'next/link';

export function ProgramCard({ program }: { program: PublicProgram }) {
  const href = `/programs/${encodeURIComponent(program.programId || program.name)}`;
  return (
    <article className="program-card">
      <div className="program-card__body">
        <div className="program-mark">
          <Image src="/images/hiraya-crest.png" alt="" width={28} height={28} />
        </div>
        <h3>{program.name}</h3>
        <p>{program.description}</p>
      </div>
      <div className="program-card__links">
        <Link className="program-apply" href={href}>
          View details
        </Link>
        <EnrollTrigger className="program-apply" program={program.name} magnetic={false}>
          Apply
        </EnrollTrigger>
      </div>
    </article>
  );
}
