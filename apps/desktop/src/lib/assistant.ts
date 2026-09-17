import type { HirayaDatabase } from '@hiraya/types';
import { displayName, studentDisplay } from '@hiraya/utils';
import { PAGE_COPY, type ViewId } from './views';

export const ASSISTANT_FILTER = 'hiraya-assistant-filter';
export const ASSISTANT_WORKSPACE = 'hiraya-assistant-workspace';

export type AssistantResult = {
  reply: string;
  view?: ViewId;
  query?: string;
  teacherId?: string;
  openMessages?: boolean;
};

const PAGE_ALIASES: { view: ViewId; keys: string[] }[] = [
  { view: 'dashboard', keys: ['dashboard', 'home', 'overview', 'main'] },
  { view: 'students', keys: ['students', 'student', 'learners', 'children', 'kids'] },
  { view: 'teachers', keys: ['teachers', 'teacher', 'staff', 'faculty'] },
  { view: 'parents', keys: ['parents', 'parent', 'families', 'family'] },
  { view: 'enrollment', keys: ['enrollment', 'enrolment', 'applications', 'applicants'] },
  { view: 'programs', keys: ['programs', 'program'] },
  { view: 'classes', keys: ['classes', 'class', 'rooms'] },
  { view: 'modules', keys: ['modules', 'module', 'lessons', 'curriculum'] },
  { view: 'calendar', keys: ['calendar', 'schedule', 'schedules', 'timetable'] },
  { view: 'tasks', keys: ['tasks', 'task'] },
  { view: 'announcements', keys: ['announcements', 'announcement', 'news'] },
  { view: 'sessions', keys: ['sessions', 'session', 'packages'] },
  { view: 'attendance', keys: ['attendance'] },
  { view: 'progress', keys: ['progress', 'milestones', 'milestone'] },
  { view: 'payments', keys: ['payments', 'payment', 'billing', 'finance'] },
  { view: 'notifications', keys: ['notifications', 'alerts', 'notices'] },
  { view: 'reports', keys: ['reports', 'report'] },
  { view: 'settings', keys: ['settings', 'account'] },
  { view: 'messages', keys: ['messages', 'message', 'inbox', 'chat'] },
];

function clean(text: string) {
  return text
    .toLowerCase()
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pageMatch(text: string): ViewId | null {
  const ranked = PAGE_ALIASES.map((item) => {
    const hit = item.keys.find((key) => text.includes(key));
    return hit ? { view: item.view, len: hit.length } : null;
  }).filter(Boolean) as { view: ViewId; len: number }[];
  ranked.sort((a, b) => b.len - a.len);
  return ranked[0]?.view || null;
}

function after(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[1]?.trim() || '';
}

function scoreName(hay: string, needle: string) {
  const h = hay.toLowerCase();
  const n = needle.toLowerCase();
  if (!n) return 0;
  if (h === n) return 100;
  if (h.startsWith(n)) return 80;
  if (h.includes(n)) return 60;
  const parts = n.split(' ').filter(Boolean);
  if (parts.length && parts.every((part) => h.includes(part))) return 50;
  return 0;
}

export function runAssistant(raw: string, store: HirayaDatabase): AssistantResult {
  const text = clean(raw);
  if (!text) return { reply: 'Type a page to open, or a name to find.' };

  if (/^(help|what can you do|\?)$/.test(text)) {
    return {
      reply:
        'I can open desks and find people. Try “open teachers”, “go to enrollment”, “find student Ana”, or “open workspace for Maria”. I do not save or delete records.',
    };
  }

  if (/\b(message|messages|inbox|chat)\b/.test(text) && !/\bstudent|teacher|parent\b/.test(text)) {
    return { reply: 'Opening Messages.', openMessages: true };
  }

  const go = /^(open|go to|goto|take me to|show|navigate to|switch to)\s+(.+)$/.exec(text);
  if (go) {
    const view = pageMatch(go[2]);
    if (view === 'messages') return { reply: 'Opening Messages.', openMessages: true };
    if (view) {
      return { reply: `Opening ${PAGE_COPY[view].title}.`, view };
    }
  }

  const viewOnly = pageMatch(text);
  if (viewOnly && /^(open|go|show|take|navigate|switch)/.test(text)) {
    if (viewOnly === 'messages') return { reply: 'Opening Messages.', openMessages: true };
    return { reply: `Opening ${PAGE_COPY[viewOnly].title}.`, view: viewOnly };
  }

  const workspaceName = after(text, /(?:open\s+)?workspace(?:\s+for|\s+of)?\s+(.+)/);
  if (workspaceName || /\bworkspace\b/.test(text)) {
    const needle = workspaceName || after(text, /(?:teacher|for)\s+(.+)/);
    const teachers = store.users.filter((item) => item.role === 'teacher');
    const ranked = teachers
      .map((item) => ({ item, score: scoreName(displayName(item), needle) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score);
    if (ranked[0]) {
      return {
        reply: `Opening ${displayName(ranked[0].item)}’s workspace.`,
        view: 'teachers',
        teacherId: ranked[0].item.userId,
      };
    }
    if (needle) return { reply: `I could not find a teacher named “${needle}”.` };
    return { reply: 'Name the teacher whose workspace I should open.', view: 'teachers' };
  }

  const findKind = text.match(/\b(student|learner|child|teacher|parent|application|enrollment)\b/);
  const findName =
    after(text, /(?:find|search|look up|lookup|who is|where's|where is|open)\s+(?:student|learner|child|teacher|parent|application)?\s*(.+)/) ||
    after(text, /(?:find|search)\s+(.+)/);

  if (findName || (findKind && /find|search|look|who|where|open/.test(text))) {
    const needle = findName || after(text, /(?:student|teacher|parent|learner|child)\s+(.+)/);
    if (!needle) return { reply: 'Tell me the name to look for.' };

    const kind = findKind?.[1] || '';
    if (kind.includes('teacher')) {
      const hit = store.users
        .filter((item) => item.role === 'teacher')
        .map((item) => ({ item, score: scoreName(`${displayName(item)} ${item.email} ${item.phone}`, needle) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (!hit) return { reply: `No teacher matched “${needle}”.`, view: 'teachers', query: needle };
      return {
        reply: `Found ${displayName(hit.item)} in Teachers.`,
        view: 'teachers',
        query: displayName(hit.item),
      };
    }
    if (kind.includes('parent')) {
      const hit = store.users
        .filter((item) => item.role === 'parent')
        .map((item) => ({ item, score: scoreName(`${displayName(item)} ${item.email} ${item.phone}`, needle) }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (!hit) return { reply: `No parent matched “${needle}”.`, view: 'parents', query: needle };
      return { reply: `Found ${displayName(hit.item)} in Parents.`, view: 'parents', query: displayName(hit.item) };
    }
    if (kind.includes('application') || kind.includes('enroll')) {
      const hit = store.enrollmentApplications
        .map((item) => ({
          item,
          score: Math.max(scoreName(item.studentFullname, needle), scoreName(item.parentFullname, needle)),
        }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)[0];
      if (!hit) return { reply: `No application matched “${needle}”.`, view: 'enrollment', query: needle };
      return {
        reply: `Found application for ${hit.item.studentFullname} (${hit.item.status || 'pending'}).`,
        view: 'enrollment',
        query: hit.item.studentFullname,
      };
    }

    const student = store.students
      .map((item) => ({ item, score: scoreName(`${studentDisplay(item)} ${item.program}`, needle) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)[0];
    if (student) {
      return {
        reply: `Found ${studentDisplay(student.item)} in Students${student.item.program ? ` · ${student.item.program}` : ''}.`,
        view: 'students',
        query: studentDisplay(student.item),
      };
    }
    const teacher = store.users
      .filter((item) => item.role === 'teacher')
      .map((item) => ({ item, score: scoreName(displayName(item), needle) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)[0];
    if (teacher) {
      return { reply: `Found ${displayName(teacher.item)} in Teachers.`, view: 'teachers', query: displayName(teacher.item) };
    }
    const parent = store.users
      .filter((item) => item.role === 'parent')
      .map((item) => ({ item, score: scoreName(displayName(item), needle) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)[0];
    if (parent) {
      return { reply: `Found ${displayName(parent.item)} in Parents.`, view: 'parents', query: displayName(parent.item) };
    }
    return { reply: `I could not find “${needle}” in students, teachers, or parents.` };
  }

  if (viewOnly) {
    if (viewOnly === 'messages') return { reply: 'Opening Messages.', openMessages: true };
    return { reply: `Opening ${PAGE_COPY[viewOnly].title}.`, view: viewOnly };
  }

  return {
    reply: 'I can open a desk or find a person. Try “open enrollment” or “find student” plus a name.',
  };
}

export function dispatchAssistant(result: AssistantResult) {
  if (result.query) {
    try {
      sessionStorage.setItem('hiraya.assistantQuery', result.query);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(ASSISTANT_FILTER, { detail: { query: result.query } }));
  }
  if (result.teacherId) {
    try {
      sessionStorage.setItem('hiraya.openTeacherId', result.teacherId);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(ASSISTANT_WORKSPACE, { detail: { teacherId: result.teacherId } }));
  }
}
