import { ProgramCard } from '@/components/public/ProgramCard';
import type { PublicSite } from '@hiraya/types';

export function ProgramsSection({
  site,
  standalone = false,
  loading = false,
}: {
  site: PublicSite;
  standalone?: boolean;
  loading?: boolean;
}) {
  const Heading = standalone ? 'h1' : 'h2';
  return (
    <section className={standalone ? 'public-inner programs-page' : 'public-section'} id="programs">
      <header className="programs-header">
        <p className="eyebrow">Learning</p>
        <Heading>Our programs</Heading>
        <p>Choose a program that is right for your child — playgroup, nursery through grade school, tutorial, or ABA therapy.</p>
      </header>
      {loading || !site.programs.length ? (
        <p className="programs-empty">{loading ? 'Loading programs…' : 'Programs will be available soon.'}</p>
      ) : (
        <div className="programs-grid">
          {site.programs.map((program) => (
            <ProgramCard key={program.programId || program.name} program={program} />
          ))}
        </div>
      )}
    </section>
  );
}
