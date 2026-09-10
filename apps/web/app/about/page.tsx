'use client';

import { PublicChrome } from '@/components/public/PublicChrome';
import { usePublicSite } from '@/hooks/usePublicSite';

export default function AboutPage() {
  const { site } = usePublicSite();
  return (
    <PublicChrome>
      <p className="eyebrow">Our center</p>
      <h1>{site.aboutTitle || 'About HIRAYA'}</h1>
      <p>{site.description}</p>
      <div className="program-grid">
        {site.mission ? (
          <article className="info-card">
            <h3>Mission</h3>
            <p>{site.mission}</p>
          </article>
        ) : null}
        {site.vision ? (
          <article className="info-card">
            <h3>Vision</h3>
            <p>{site.vision}</p>
          </article>
        ) : null}
        {site.values ? (
          <article className="info-card">
            <h3>Values</h3>
            <p>{site.values}</p>
          </article>
        ) : null}
        <article className="info-card">
          <h3>Hours</h3>
          <p>{site.businessHours || 'Contact us for current hours.'}</p>
        </article>
      </div>
    </PublicChrome>
  );
}
