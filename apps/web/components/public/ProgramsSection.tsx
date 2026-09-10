import { ProgramCard } from '@/components/public/ProgramCard';
import type { PublicSite } from '@hiraya/types';

export function ProgramsSection({ site }: { site: PublicSite }) {
  return (
    <section className="public-section" id="programs">
      <p className="eyebrow">Learning</p>
      <h2>Our programs</h2>
      <p>Choose a program that is right for your child.</p>
      {site.programs.length === 0 ? (
        <p>Programs will be available soon.</p>
      ) : (
        <div className="program-grid">
          {site.programs.map((program) => (
            <ProgramCard key={program.programId || program.name} program={program} />
          ))}
        </div>
      )}
    </section>
  );
}
