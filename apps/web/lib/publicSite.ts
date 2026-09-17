import type { PublicSite } from '@hiraya/types';

export const HIRAYA_FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61566869041459';

export const publicDefaults: PublicSite = {
  centerName: 'HIRAYA Learning Center',
  description:
    'HIRAYA Learning Center is a safe and supportive place where children can grow, learn, and develop their skills with care.',
  aboutTitle: 'About HIRAYA',
  welcomeTitle: 'Welcome to HIRAYA Learning Center',
  welcomeMessage:
    'We provide a safe and supportive learning environment where children can grow, learn, and develop their skills.',
  mission:
    'To nurture curious, kind, and confident learners through play, guided instruction, and partnership with families.',
  vision:
    'A community where every child is known, supported, and ready for the next step in learning.',
  values: 'Care, curiosity, respect, and joyful learning in every classroom.',
  address: 'Rodriguez (Montalban), Rizal, Philippines',
  phone: '+63 917 753 4258',
  email: 'hirayakids.learning@gmail.com',
  website: HIRAYA_FACEBOOK_URL,
  businessHours: 'Monday–Friday, 8:00–17:00',
  hasLogo: false,
  contentUpdatedAt: '',
  programs: [
    { programId: 'prg_kinder', name: 'Kinder', description: 'Play-based kindergarten that builds literacy, numeracy, and social skills.' },
    { programId: 'prg_g1', name: 'Grade 1', description: 'Foundational grade-one learning with guided reading and classroom routines.' },
    { programId: 'prg_g2', name: 'Grade 2', description: 'Growing independence in reading, writing, and problem solving.' },
    { programId: 'prg_g3', name: 'Grade 3', description: 'Deeper academic skills with project work and collaborative learning.' },
  ],
};

export function crestSrc(site?: PublicSite | null): string {
  if (site?.hasLogo) {
    const stamp = encodeURIComponent(site.contentUpdatedAt || '');
    return `/api/public/logo?t=${stamp}`;
  }
  return '/images/hiraya-crest.png';
}

export function facebookHref(site?: PublicSite | null): string {
  const custom = (site?.website || '').trim();
  if (/facebook\.com/i.test(custom)) return custom;
  return HIRAYA_FACEBOOK_URL;
}

export function withPublicFallback(site?: Partial<PublicSite> | null): PublicSite {
  const merged: PublicSite = {
    ...publicDefaults,
    ...site,
    programs: site?.programs?.length ? site.programs : [],
  };
  if (!merged.website?.trim()) merged.website = HIRAYA_FACEBOOK_URL;
  return merged;
}

const PLACEHOLDER_COPY = /ask the center|will be posted by the center|coming soon|lorem ipsum/i;

export function isUnsetPublicValue(value?: string | null, kind?: 'address' | 'phone' | 'email'): boolean {
  const v = (value || '').trim();
  if (!v || PLACEHOLDER_COPY.test(v)) return true;
  if (kind === 'address' && /^local development center$/i.test(v)) return true;
  if (kind === 'phone') {
    const digits = v.replace(/\D/g, '');
    if (!digits || /^0+$/.test(digits) || digits === '09170000000' || digits === '9170000000') return true;
  }
  if (kind === 'email' && /@(hiraya\.local|example\.com)$/i.test(v)) return true;
  return false;
}
