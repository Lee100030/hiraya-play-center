import { Reveal } from '@/components/public/Reveal';
import type { PublicSite } from '@hiraya/types';

export function SocialProof({ site }: { site: PublicSite }) {
  const programs = site.programs.length || 4;
  return (
    <Reveal>
      <section className="public-section proof-section" id="families">
        <header className="section-header">
          <p className="eyebrow">Trust</p>
          <h2>Families choose a calm, known&nbsp;place</h2>
          <p className="lede">
            HIRAYA is built for daily care: small groups, clear routines, and teachers who know each child by name.
          </p>
        </header>
        <div className="proof-stats">
          <article>
            <strong>{programs}+</strong>
            <span>Learning programs</span>
          </article>
          <article>
            <strong>Mon–Fri</strong>
            <span>{site.businessHours || 'Weekday care with family updates'}</span>
          </article>
          <article>
            <strong>★★★★★</strong>
            <span>Warm, personal center life</span>
          </article>
        </div>
        <div className="testimonials-grid">
          <blockquote className="testimonial-card">
            <p>“Drop-off feels unhurried. The teachers greet my child as if the day already belongs to them.”</p>
            <p className="author">A Kinder parent</p>
          </blockquote>
          <blockquote className="testimonial-card">
            <p>“We chose HIRAYA because the rooms are small and the communication is clear. Progress is shared, not guessed.”</p>
            <p className="author">A Grade 1 parent</p>
          </blockquote>
          <blockquote className="testimonial-card">
            <p>“It feels like a private school in the best sense: careful, kind, and never rushed.”</p>
            <p className="author">A returning family</p>
          </blockquote>
        </div>
      </section>
    </Reveal>
  );
}
