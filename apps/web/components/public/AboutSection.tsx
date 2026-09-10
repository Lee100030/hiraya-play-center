import { crestSrc } from '@/lib/publicSite';
import type { PublicSite } from '@hiraya/types';
import Image from 'next/image';
import Link from 'next/link';

export function AboutSection({ site }: { site: PublicSite }) {
  const src = crestSrc(site);
  return (
    <section className="public-section" id="about">
      <div className="about-grid">
        <div>
          <p className="eyebrow">Our center</p>
          <h2>{site.aboutTitle || 'About HIRAYA'}</h2>
          <p>
            {site.description ||
              'HIRAYA Learning Center is a safe and supportive place where children can grow, learn, and develop their skills.'}
          </p>
          {site.mission ? (
            <p>
              <strong>Mission. </strong>
              {site.mission}
            </p>
          ) : null}
          <p>
            <Link href="/about" className="btn-ghost">
              Learn more
            </Link>
          </p>
        </div>
        <div className="about-visual">
          {src.startsWith('/') ? (
            <Image src="/images/hiraya-crest.png" alt="HIRAYA Learning Center crest" width={220} height={220} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="HIRAYA Learning Center crest" />
          )}
        </div>
      </div>
    </section>
  );
}
