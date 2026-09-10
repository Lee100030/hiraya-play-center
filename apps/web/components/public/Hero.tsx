'use client';

import { crestSrc } from '@/lib/publicSite';
import type { PublicSite } from '@hiraya/types';
import dynamic from 'next/dynamic';
import { EnrollTrigger } from '@/components/public/enrollment';
import Image from 'next/image';

const GradientWaves = dynamic(() => import('@/components/public/GradientWaves'), {
  ssr: false,
});

export function Hero({ site }: { site: PublicSite }) {
  const src = crestSrc(site);
  return (
    <section className="home-stage">
      <div className="home-waves" aria-hidden="true">
        <GradientWaves
          horizonColor="#0dfb67"
          waveColor="#f0e826"
          crestColor="#FFFFFF"
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
        <h1>Growing Minds. Building Futures.</h1>
        <p>{site.welcomeMessage || site.description}</p>
        <EnrollTrigger className="btn-hero">Enroll now</EnrollTrigger>
      </div>
      <p className="home-trust">
        <span className="home-stars" aria-hidden="true">
          ★★★★★
        </span>
        <span>{site.businessHours || 'Growing together with care'}</span>
      </p>
    </section>
  );
}
