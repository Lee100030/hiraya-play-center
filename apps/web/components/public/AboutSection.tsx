import { AboutFilm } from '@/components/public/AboutFilm';
import type { PublicSite } from '@hiraya/types';
import Link from 'next/link';

export function AboutSection({ site }: { site: PublicSite }) {
  return (
    <section className="public-section about-section" id="about">
      <div className="about-copy">
        <p className="eyebrow">Our center</p>
        <h2>{site.aboutTitle || 'About HIRAYA'}</h2>
        <p>
          {site.description ||
            'Hiraya Kids Learning Center is a safe and supportive place where children can grow, learn, and develop their skills.'}
        </p>
        {site.mission || site.vision ? (
          <div className="about-statements">
            {site.mission ? (
              <p>
                <strong>Mission. </strong>
                {site.mission}
              </p>
            ) : null}
            {site.vision ? (
              <p>
                <strong>Vision. </strong>
                {site.vision}
              </p>
            ) : null}
          </div>
        ) : null}
        <p>
          <Link href="/about" className="btn-hero">
            Learn more
          </Link>
        </p>
      </div>
      <div className="about-visual">
        <AboutFilm />
      </div>
    </section>
  );
}
