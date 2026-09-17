'use client';

import { AboutSection } from '@/components/public/AboutSection';
import { CampusMoments } from '@/components/public/CampusMoments';
import { ContactSection } from '@/components/public/ContactSection';
import { EnrollmentCta } from '@/components/public/EnrollmentCta';
import { EnrollmentPath } from '@/components/public/EnrollmentPath';
import { EnrollmentProvider } from '@/components/public/enrollment';
import { Hero } from '@/components/public/Hero';
import { ProgramsSection } from '@/components/public/ProgramsSection';
import { Reveal } from '@/components/public/Reveal';
import { SiteFooter } from '@/components/public/SiteFooter';
import { SiteHeader } from '@/components/public/SiteHeader';
import { SocialProof } from '@/components/public/SocialProof';
import { StickyEnroll } from '@/components/public/StickyEnroll';
import { usePublicSite } from '@/hooks/usePublicSite';
import { ReactNode, useEffect } from 'react';

export function PublicChrome({
  children,
  home = false,
  autoEnroll = false,
  enrollProgram = '',
}: {
  children?: ReactNode;
  home?: boolean;
  autoEnroll?: boolean;
  enrollProgram?: string;
}) {
  const { site, loading } = usePublicSite();

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        if (Math.hypot(dx, dy) < 130) {
          el.style.transform = `translate3d(${dx * 0.22}px, ${dy * 0.22}px, 0)`;
        } else {
          el.style.transform = '';
        }
      });
    };
    const onLeave = () => {
      document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
        el.style.transform = '';
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <EnrollmentProvider autoOpen={autoEnroll} initialProgram={enrollProgram}>
      <div className="public-frame">
        {process.env.NEXT_PUBLIC_SHOW_DEV_BANNER === '1' ? (
          <p className="dev-banner" role="status">
            Website under Development
          </p>
        ) : null}
        <SiteHeader site={site} />
        {home ? (
          <>
            <Hero site={site} />
            <Reveal>
              <AboutSection site={site} />
            </Reveal>
            <CampusMoments />
            <Reveal>
              <ProgramsSection site={site} loading={loading} />
            </Reveal>
            <SocialProof site={site} />
            <EnrollmentPath />
            <Reveal>
              <EnrollmentCta message={site.welcomeMessage || site.description} />
            </Reveal>
            <Reveal>
              <ContactSection site={site} />
            </Reveal>
          </>
        ) : (
          <main className="public-page">{children}</main>
        )}
        <SiteFooter site={site} />
        <StickyEnroll />
      </div>
    </EnrollmentProvider>
  );
}
