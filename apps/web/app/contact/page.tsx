'use client';

import { ContactSection } from '@/components/public/ContactSection';
import { PublicChrome } from '@/components/public/PublicChrome';
import { usePublicSite } from '@/hooks/usePublicSite';

export default function ContactPage() {
  const { site } = usePublicSite();
  return (
    <PublicChrome>
      <ContactSection site={site} />
    </PublicChrome>
  );
}
