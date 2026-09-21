import { CENTER_PROGRAMS, REQUIREMENT_DOCS } from '@hiraya/utils';
import type { EnrollmentApplication } from '@hiraya/types';

export { CENTER_PROGRAMS, PIPELINE_STAGES, REQUIREMENT_DOCS, NEWS_CATEGORIES, normalizePipeline } from '@hiraya/utils';

export type RequirementDoc = { kind: string; status: 'pending' | 'approved' | 'rejected'; note: string };

export type ApplicationExtra = {
  parentAddress: string;
  relationship: string;
  socialMedia: string;
  nickname: string;
  currentSchool: string;
  gradeLevel: string;
  docs: RequirementDoc[];
};

export function blankDocs(): RequirementDoc[] {
  return REQUIREMENT_DOCS.map((kind) => ({ kind, status: 'pending', note: '' }));
}

export function parseApplicationExtra(row?: EnrollmentApplication | null): ApplicationExtra {
  const fallback: ApplicationExtra = {
    parentAddress: '',
    relationship: '',
    socialMedia: '',
    nickname: '',
    currentSchool: '',
    gradeLevel: '',
    docs: blankDocs(),
  };
  if (!row?.extraJson) return fallback;
  try {
    const parsed = JSON.parse(row.extraJson) as Partial<ApplicationExtra>;
    return {
      ...fallback,
      ...parsed,
      docs: Array.isArray(parsed.docs) && parsed.docs.length ? parsed.docs : fallback.docs,
    };
  } catch {
    return fallback;
  }
}

export function stringifyApplicationExtra(extra: ApplicationExtra): string {
  return JSON.stringify(extra);
}

export function programChoices() {
  return CENTER_PROGRAMS;
}
