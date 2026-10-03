'use client';

import { EnrollTrigger } from '@/components/public/enrollment';
import { ProgramDetailModal } from '@/components/public/ProgramDetailModal';
import type { PublicProgram } from '@hiraya/types';
import Image from 'next/image';
import { useState } from 'react';

function programTeaser(description: string) {
  const text = description.trim();
  const peso = text.indexOf('₱');
  const beforePrice = peso > 24 ? text.slice(0, peso).trim() : text;
  const sentence = beforePrice.split(/(?<=\.)\s/)[0] || beforePrice;
  return sentence.replace(/[.\s]+$/, '');
}

export function ProgramCard({ program }: { program: PublicProgram }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="program-card">
      <div className="program-card__body">
        <div className="program-mark">
          <Image src="/images/hiraya-crest.png" alt="" width={28} height={28} />
        </div>
        <h3>{program.name}</h3>
        <p>{programTeaser(program.description)}</p>
      </div>
      <div className="program-card__links">
        <button type="button" className="program-apply" onClick={() => setOpen(true)}>
          View details
        </button>
        <EnrollTrigger className="program-apply" program={program.name} magnetic={false}>
          Apply
        </EnrollTrigger>
      </div>
      {open ? <ProgramDetailModal program={program} onClose={() => setOpen(false)} /> : null}
    </article>
  );
}
