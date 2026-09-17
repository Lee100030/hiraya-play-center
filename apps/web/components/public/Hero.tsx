'use client';

import { AntigravityField } from '@/components/public/AntigravityField';
import { CampusTour } from '@/components/public/CampusTour';
import { EnrollTrigger } from '@/components/public/enrollment';
import { crestSrc } from '@/lib/publicSite';
import type { PublicSite } from '@hiraya/types';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useState } from 'react';

const GradientWaves = dynamic(() => import('@/components/public/GradientWaves'), {
  ssr: false,
});

export function Hero({ site }: { site: PublicSite }) {
  const src = crestSrc(site);
  const [tour, setTour] = useState(false);

  return (
    <section className="home-stage">
      <AntigravityField />
      <div className="home-waves" aria-hidden="true">
        <GradientWaves
          horizonColor="#12301F"
          waveColor="#C9A227"
          crestColor="#F5F1E6"
          speed={0.4}
          amplitude={2.5}
          waveScale={0.6}
          waveRatio={0.9}
          swell={35}
          turbulence={20}
          tilt={1.11}
          zoom={1}
          height={5.5}
          fogDepth={15}
          detail="medium"
          brightness={1}
          opacity={1}
          mouseInteraction
          parallaxStrength={0.5}
          grain
          grainIntensity={0.05}
        />
      </div>
      <div className="home-stage-glow" aria-hidden="true" />
      <div className="home-hero">
        {src.startsWith('/') ? (
          <Image
            className="home-hero-logo"
            src="/images/hiraya-crest.png"
            alt="HIRAYA Learning Center crest"
            width={280}
            height={280}
            priority
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="home-hero-logo" src={src} alt="HIRAYA Learning Center crest" />
        )}
        <p className="home-kicker">{site.centerName}</p>
        <h1>
          Growing minds.
          <br />
          Building&nbsp;futures.
        </h1>
        <p className="lede-light">{site.welcomeMessage || site.description}</p>
        <div className="hero-cta-row">
          <EnrollTrigger className="btn-hero">Start enrollment</EnrollTrigger>
          <button type="button" className="btn-ghost-light" onClick={() => setTour(true)}>
            Watch a campus tour
          </button>
        </div>
      </div>
      <p className="home-trust">
        <span className="home-stars" aria-hidden="true">
          ★★★★★
        </span>
        <span>Small classes · Family partnership · {site.businessHours || 'Weekday learning'}</span>
      </p>
      {tour ? <CampusTour onClose={() => setTour(false)} /> : null}
    </section>
  );
}
