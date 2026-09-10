'use client';

import { AboutSection } from '@/components/public/AboutSection';
import { AntigravityField } from '@/components/public/AntigravityField';
import { ContactSection } from '@/components/public/ContactSection';
import { EnrollmentCta } from '@/components/public/EnrollmentCta';
import { EnrollmentProvider } from '@/components/public/enrollment';
import { Hero } from '@/components/public/Hero';
import { ProgramsSection } from '@/components/public/ProgramsSection';
import { SiteFooter } from '@/components/public/SiteFooter';
import { SiteHeader } from '@/components/public/SiteHeader';
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
  const { site } = usePublicSite();

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
        <AntigravityField />
        <p className="dev-banner" role="status">
          Website under Development
        </p>
        <SiteHeader site={site} />
        {home ? (
          <>
            <Hero site={site} />
            <AboutSection site={site} />
            <ProgramsSection site={site} />
            <EnrollmentCta message={site.welcomeMessage || site.description} />
            <ContactSection site={site} />
          </>
        ) : (
          <main className="public-page">{children}</main>
        )}
        <SiteFooter site={site} />
      </div>
    </EnrollmentProvider>
  );
}
