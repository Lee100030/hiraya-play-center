import type { PublicSite } from '@hiraya/types';

export const HIRAYA_FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61566869041459';

export const publicDefaults: PublicSite = {
  centerName: 'Hiraya Kids Learning Center',
  description:
    'At Hiraya Kids Learning Center, every child learns through meaningful play, exploration, and hands-on experiences. The curriculum is child-centered and play-based, supporting each child’s unique journey while fostering confidence, creativity, independence, and a lifelong love for learning. Isang Hiraya para sa mga bata.',
  aboutTitle: 'About Hiraya Kids Learning Center',
  welcomeTitle: 'Welcome to Hiraya Kids Learning Center',
  welcomeMessage:
    'Every child learns best through meaningful play, exploration, and hands-on experiences. School year 2026–2027.',
  mission:
    'To create a joyful, inclusive, and enriching learning environment that nurtures the whole child—mind, body, and spirit—through play, creativity, and meaningful experiences.',
  vision:
    'To be a trusted early childhood learning center that inspires young learners to grow into compassionate, capable, and confident individuals who contribute positively to their community and the world.',
  values:
    '1. Child-centered learning — we honor each child’s unique pace, interests, and abilities, and let curiosity lead. 2. Holistic development — we nurture the mind, body, and spirit through balanced experiences that promote emotional, social, physical, and cognitive growth. 3. Inclusivity and respect — we embrace diversity so every child feels valued, understood, and respected. 4. Love for learning — we cultivate wonder, creativity, and a lifelong passion for exploration and discovery. 5. Community and collaboration — parents and teachers work hand-in-hand to support each child’s journey. 6. Integrity and responsibility — we model honesty, kindness, and accountability in learning and play. 7. Care for the world — we inspire children to respect nature, care for their surroundings, and contribute positively to their community.',
  address: 'Rodriguez (Montalban), Rizal, Philippines',
  phone: '+63 917 753 4258',
  email: 'hirayakids.learning@gmail.com',
  website: HIRAYA_FACEBOOK_URL,
  businessHours: 'Playgroup daily · Nursery–Grade 2 weekdays 8:00–10:30',
  hasLogo: false,
  contentUpdatedAt: '',
  programs: [
    { programId: 'prg_playgroup', name: 'Playgroup', description: 'Playgroup for ages 1.5–8, Monday to Sunday, with paper work, obstacle courses, and life-skills activities.' },
    { programId: 'prg_tiny_tots', name: 'Tiny Tots', description: 'Playgroup for ages 1.5–2.5. Monday to Sunday, 10:00 AM–11:30 AM.' },
    { programId: 'prg_bright_buds', name: 'Bright Buds', description: 'Playgroup for ages 2.6–3.9. Monday to Sunday, 12:30 PM–2:00 PM.' },
    { programId: 'prg_rising_stars', name: 'Rising Stars', description: 'Playgroup for ages 4–8. Monday to Sunday, 2:30 PM–4:00 PM.' },
    { programId: 'prg_preschool', name: 'Pre-school', description: 'Nursery, Pre-Kindergarten, Kindergarten, and Grades 1–3. Monday to Friday, 8:00 AM–10:30 AM. School year 2026–2027.' },
    { programId: 'prg_kinder', name: 'Kinder', description: 'Kindergarten, Monday to Friday, 8:00 AM–10:30 AM. School readiness through academics and social-emotional growth.' },
    { programId: 'prg_g1', name: 'Grade 1', description: 'Grade 1, Monday to Friday, 8:00 AM–10:30 AM. Literacy, numeracy, critical thinking, and independent learning.' },
    { programId: 'prg_tutorial', name: 'Tutorial Session', description: 'Tutorial for ages 4–12. Academic readiness, homework assistance, and skill reinforcement. Enrollment is subject to slot availability.' },
    { programId: 'prg_aba', name: 'ABA Therapy', description: 'ABA therapy for ages 2–12. Behavior, communication, social interaction, and daily living skills. Enrollment is subject to slot availability.' },
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
