'use client';

import { PublicChrome } from '@/components/public/PublicChrome';
import { CAMPUS_PHOTOS } from '@/lib/campus';
import { crestSrc } from '@/lib/publicSite';
import { usePublicSite } from '@/hooks/usePublicSite';
import Image from 'next/image';
import Link from 'next/link';

const staffHighlights = [
  {
    title: 'Lead teachers',
    copy: 'Classroom leads plan lessons, track progress, and keep families informed.',
  },
  {
    title: 'Learning support',
    copy: 'Support staff help children settle in, practice skills, and stay safe throughout the day.',
  },
  {
    title: 'Family partners',
    copy: 'Our team works with parents so learning continues from school to home.',
  },
];

export default function AboutPage() {
  const { site } = usePublicSite();
  const src = crestSrc(site);

  return (
    <PublicChrome>
      <section className="about-page-hero">
        <header className="section-header">
          <p className="eyebrow">Our center</p>
          <h1>{site.aboutTitle || 'About HIRAYA'}</h1>
          <p>
            {site.description ||
              'HIRAYA Learning Center is a safe and supportive place where children can grow, learn, and develop their skills.'}
          </p>
          <p>
            <Link href="/programs" className="btn-hero">
              Learn more
            </Link>
          </p>
        </header>
        <div className="about-visual">
          {src.startsWith('/') ? (
            <Image src="/images/hiraya-crest.png" alt="HIRAYA Learning Center crest" width={220} height={220} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="HIRAYA Learning Center crest" />
          )}
        </div>
      </section>

      <section className="public-inner">
        <header className="section-header">
          <p className="eyebrow">Guiding lights</p>
          <h2>Mission, vision, and values</h2>
        </header>
        <div className="program-grid">
          <article className="info-card">
            <div className="program-mark" aria-hidden="true">
              <span>M</span>
            </div>
            <h3>Mission</h3>
            <p>{site.mission}</p>
          </article>
          <article className="info-card">
            <div className="program-mark" aria-hidden="true">
              <span>V</span>
            </div>
            <h3>Vision</h3>
            <p>{site.vision}</p>
          </article>
          <article className="info-card">
            <div className="program-mark" aria-hidden="true">
              <span>♥</span>
            </div>
            <h3>Values</h3>
            <p>{site.values}</p>
          </article>
        </div>
      </section>

      <section className="public-inner">
        <header className="section-header">
          <p className="eyebrow">Our people</p>
          <h2>Staff and teacher highlights</h2>
          <p>Families meet a dedicated team who keep classrooms calm, curious, and caring.</p>
        </header>
        <div className="program-grid">
          {staffHighlights.map((item) => (
            <article className="info-card" key={item.title}>
              <div className="program-mark" aria-hidden="true">
                <Image src="/images/hiraya-crest.png" alt="" width={28} height={28} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-inner">
        <header className="section-header">
          <p className="eyebrow">Campus</p>
          <h2>Facility photos</h2>
          <p>A look at the spaces where children learn, play, and rest.</p>
        </header>
        <div className="facility-grid">
          {CAMPUS_PHOTOS.map((item) => (
            <article className="facility-card" key={item.src}>
              <div className="facility-photo">
                <Image src={item.src} alt={item.title} width={720} height={420} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>
    </PublicChrome>
  );
}
