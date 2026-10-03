import { crestSrc } from '@/lib/publicSite';
import type { PublicSite } from '@hiraya/types';
import Image from 'next/image';
import Link from 'next/link';

export function AboutSection({ site }: { site: PublicSite }) {
  const src = crestSrc(site);
  return (
    <section className="public-section about-section" id="about">
      <header className="section-header">
        <p className="eyebrow">Our center</p>
        <h2>{site.aboutTitle || 'About HIRAYA'}</h2>
        <p>
          {site.description ||
            'Hiraya Kids Learning Center is a safe and supportive place where children can grow, learn, and develop their skills.'}
        </p>
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
        <p>
          <Link href="/about" className="btn-hero">
            Learn more
          </Link>
        </p>
      </header>
      <div className="about-visual">
        {src.startsWith('/') ? (
          <Image src="/images/hiraya-crest.png" alt="Hiraya Kids Learning Center crest" width={220} height={220} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Hiraya Kids Learning Center crest" />
        )}
      </div>
    </section>
  );
}
