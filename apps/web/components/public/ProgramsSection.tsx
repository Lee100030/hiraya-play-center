import { ProgramCard } from '@/components/public/ProgramCard';
import type { PublicSite } from '@hiraya/types';
import { CENTER_PROGRAMS } from '@hiraya/utils';

export function ProgramsSection({ site }: { site: PublicSite }) {
  const programs =
    site.programs.length > 0
      ? site.programs
      : CENTER_PROGRAMS.filter((p) => ['playgroup', 'preschool', 'aba', 'tutorial'].includes(p.id)).map((p) => ({
          programId: p.id,
          name: p.name,
          description: p.name,
        }));
  return (
    <section className="public-section" id="programs">
      <p className="eyebrow">Learning</p>
      <h2>Our programs</h2>
      <p>Choose a program that is right for your child.</p>
      {programs.length === 0 ? (
        <p>Programs will be available soon.</p>
      ) : (
        <div className="program-grid">
          {programs.map((program) => (
            <ProgramCard key={program.programId || program.name} program={program} />
          ))}
        </div>
      )}
    </section>
  );
}
