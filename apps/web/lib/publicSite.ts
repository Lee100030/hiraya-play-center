import { resolveApiBaseUrl } from '@hiraya/config';
import type { PublicSite } from '@hiraya/types';

export const publicDefaults: PublicSite = {
  centerName: 'HIRAYA Learning Center',
  description:
    'Child care, therapy, and family connection — growing together with care.',
  aboutTitle: 'About HIRAYA',
  welcomeTitle: 'Welcome to HIRAYA Learning Center',
  welcomeMessage:
    'We provide a safe and supportive learning environment where children can grow, learn, and develop their skills.',
  mission: '',
  vision: '',
  values: '',
  address: 'Local development center',
  phone: '09170000000',
  email: 'hello@hiraya.local',
  website: '',
  businessHours: 'Monday–Friday, 8:00–17:00',
  hasLogo: false,
  contentUpdatedAt: '',
  programs: [
    { programId: 'prg_kinder', name: 'Kinder', description: 'Kindergarten program' },
    { programId: 'prg_g1', name: 'Grade 1', description: 'Grade 1 program' },
  ],
};

export function crestSrc(site?: PublicSite | null): string {
  if (site?.hasLogo) {
    const stamp = encodeURIComponent(site.contentUpdatedAt || '');
    const base = process.env.NEXT_PUBLIC_API_URL || '';
    return `${resolveApiBaseUrl(base)}/api/public/logo?t=${stamp}`;
  }
  return '/images/hiraya-crest.png';
}

export function withPublicFallback(site?: Partial<PublicSite> | null): PublicSite {
  return {
    ...publicDefaults,
    ...site,
    programs: site?.programs?.length ? site.programs : publicDefaults.programs,
  };
}
