'use client';

import { EnrollTrigger } from '@/components/public/enrollment';
import type { PublicProgram } from '@hiraya/types';
import Image from 'next/image';

export function ProgramCard({ program }: { program: PublicProgram }) {
  return (
    <article className="program-card">
      <div className="program-mark">
        <Image src="/images/hiraya-crest.png" alt="" width={28} height={28} />
      </div>
      <h3>{program.name}</h3>
      <p>{program.description}</p>
      <EnrollTrigger className="program-apply" program={program.name}>
        Apply to {program.name}
      </EnrollTrigger>
    </article>
  );
}
