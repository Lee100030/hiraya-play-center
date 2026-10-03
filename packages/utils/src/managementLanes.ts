import type { HirayaDatabase, Student } from '@hiraya/types';
import { assignedStudentsForTeacher, programsForTeacher, studentPlacement } from './assignments';

export type ManagementLane = {
  id: string;
  label: string;
  aliases: readonly string[];
};

export const MANAGEMENT_LANES: readonly ManagementLane[] = [
  {
    id: 'playgroup',
    label: 'Playgroup',
    aliases: ['playgroup', 'play group', 'play-group'],
  },
  {
    id: 'prekinder',
    label: 'Pre-kinder',
    aliases: ['pre-kinder', 'prekinder', 'pre kinder', 'pre-kindergarten', 'prekindergarten'],
  },
  {
    id: 'kinder',
    label: 'Kinder',
    aliases: ['kindergarten', 'kinder'],
  },
  {
    id: 'nursery',
    label: 'Nursery',
    aliases: ['nursery'],
  },
  {
    id: 'grade1',
    label: 'Grade 1',
    aliases: ['grade 1', 'grade1', 'grade-1', 'g1'],
  },
  {
    id: 'grade2',
    label: 'Grade 2',
    aliases: ['grade 2', 'grade2', 'grade-2', 'g2'],
  },
  {
    id: 'grade3',
    label: 'Grade 3',
    aliases: ['grade 3', 'grade3', 'grade-3', 'g3'],
  },
  {
    id: 'aba',
    label: 'ABA Therapy',
    aliases: ['aba', 'ava', 'therapist', 'aba therapist'],
  },
  {
    id: 'tutorial',
    label: 'Tutorial Session',
    aliases: ['tutorial'],
  },
];

/** Lane ids are built-in keys or LearningProgram.programId for custom programs. */
export type ManagementLaneId = string;

export const PEOPLE_LANE_VIEWS = ['students', 'parents', 'teachers'] as const;

/** Nav items that use the shared program-lane dropdown. */
export const MANAGEMENT_LANE_VIEWS = [...PEOPLE_LANE_VIEWS, 'modules', 'sessions'] as const;

export type ManagementLaneViewId = (typeof MANAGEMENT_LANE_VIEWS)[number];

export function isManagementLaneView(value?: string | null): value is ManagementLaneViewId {
  return MANAGEMENT_LANE_VIEWS.includes(value as ManagementLaneViewId);
}

export function isBuiltinManagementLane(id?: string | null): boolean {
  return MANAGEMENT_LANES.some((lane) => lane.id === id);
}

/** Legacy combined preschool specialty → Pre-kinder for older records. */
const LEGACY_PRESCHOOL_ALIASES = ['pre-school', 'preschool', 'pre school', 'grade 1–3', 'grade 1-3', 'grade1-3'];

function matchesBuiltInLane(text: string): ManagementLaneId | null {
  const lower = text.trim().toLowerCase();
  if (!lower) return null;
  if (lower === 'preschool') return 'prekinder';
  for (const lane of MANAGEMENT_LANES) {
    if (lane.id === lower) return lane.id;
  }
  const ranked = MANAGEMENT_LANES.flatMap((lane) =>
    [...lane.aliases]
      .sort((a, b) => b.length - a.length)
      .map((alias) => ({ laneId: lane.id, alias })),
  ).sort((a, b) => b.alias.length - a.alias.length);

  for (const { laneId, alias } of ranked) {
    if (aliasMatches(lower, alias)) return laneId;
  }
  if (LEGACY_PRESCHOOL_ALIASES.some((alias) => aliasMatches(lower, alias))) return 'prekinder';
  return null;
}

/** Built-in lanes plus active LearningProgram rows that are not already covered. */
export function managementLanesFor(store?: HirayaDatabase | null): ManagementLane[] {
  const custom: ManagementLane[] = [];
  for (const program of store?.programs || []) {
    if ((program.status || 'active').toLowerCase() === 'archived') continue;
    const name = (program.name || '').trim();
    if (!name) continue;
    if (matchesBuiltInLane(name)) continue;
    custom.push({
      id: program.programId,
      label: name,
      aliases: [name.toLowerCase(), program.programId.toLowerCase()],
    });
  }
  custom.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  return [...MANAGEMENT_LANES, ...custom];
}

export function parsePeopleLane(value?: string | null, store?: HirayaDatabase | null): ManagementLaneId | null {
  const raw = (value || '').trim();
  if (!raw) return null;
  return managementLanesFor(store).some((lane) => lane.id === raw) ? raw : null;
}

export function laneLabel(id?: string | null, store?: HirayaDatabase | null): string {
  if (!id) return '';
  return managementLanesFor(store).find((lane) => lane.id === id)?.label || '';
}

function aliasMatches(text: string, alias: string): boolean {
  if (text === alias) return true;
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?![a-z0-9])`, 'i').test(text);
}

export function programLane(value?: string | null, store?: HirayaDatabase | null): ManagementLaneId | null {
  const text = (value || '').trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const builtIn = matchesBuiltInLane(text);
  if (builtIn) return builtIn;

  const lanes = managementLanesFor(store);
  for (const lane of lanes) {
    if (lane.id === text || lane.id === lower) return lane.id;
  }
  const ranked = lanes
    .flatMap((lane) =>
      [...lane.aliases]
        .sort((a, b) => b.length - a.length)
        .map((alias) => ({ laneId: lane.id, alias })),
    )
    .sort((a, b) => b.alias.length - a.alias.length);

  for (const { laneId, alias } of ranked) {
    if (aliasMatches(lower, alias)) return laneId;
  }
  return null;
}

export function specialtyLaneId(value?: string | null, store?: HirayaDatabase | null): ManagementLaneId | null {
  return programLane(value, store);
}

export function specialtyLaneLabel(value?: string | null, store?: HirayaDatabase | null): string {
  const id = specialtyLaneId(value, store);
  return id ? laneLabel(id, store) : '';
}

export function studentInLane(store: HirayaDatabase, student: Student, lane?: ManagementLaneId | null): boolean {
  if (!lane) return true;
  const placement = studentPlacement(store, student.studentId);
  return [student.program, student.gradeLevel, placement.programName, placement.className].some(
    (value) => programLane(value, store) === lane,
  );
}

export function childrenOfParent(store: HirayaDatabase, parentId: string): Student[] {
  const ids = new Set(
    store.parentStudents.filter((link) => link.parentId === parentId && link.isActive).map((link) => link.studentId),
  );
  if (ids.size === 0) return store.students.filter((student) => student.parentId === parentId);
  return store.students.filter((student) => ids.has(student.studentId) || student.parentId === parentId);
}

export function parentInLane(store: HirayaDatabase, parentId: string, lane?: ManagementLaneId | null): boolean {
  if (!lane) return true;
  return childrenOfParent(store, parentId).some((student) => studentInLane(store, student, lane));
}

export function teacherInLane(store: HirayaDatabase, userId: string, lane?: ManagementLaneId | null): boolean {
  if (!lane) return true;
  const profile = store.teacherProfiles.find((row) => row.userId === userId);
  const user = store.users.find((row) => row.userId === userId);
  const designated = specialtyLaneId(profile?.specialty, store);
  if (designated) return designated === lane;
  if (programLane(user?.position, store) === lane) return true;
  if (programsForTeacher(store, userId).some((program) => programLane(program.name, store) === lane)) return true;
  if (store.classes.some((row) => row.teacherId === userId && programLane(row.name, store) === lane)) return true;
  return assignedStudentsForTeacher(store, userId).some((student) => studentInLane(store, student, lane));
}

export function moduleInLane(
  store: HirayaDatabase,
  module: { programId?: string; gradeLevel?: string; subject?: string; moduleType?: string },
  lane?: ManagementLaneId | null,
): boolean {
  if (!lane) return true;
  const program = store.programs.find((row) => row.programId === module.programId);
  return [module.gradeLevel, module.subject, module.moduleType, program?.name].some(
    (value) => programLane(value, store) === lane,
  );
}

export function sessionPackageInLane(
  store: HirayaDatabase,
  pack: { studentId?: string; programId?: string },
  lane?: ManagementLaneId | null,
): boolean {
  if (!lane) return true;
  const student = store.students.find((row) => row.studentId === pack.studentId);
  if (student) return studentInLane(store, student, lane);
  const program = store.programs.find((row) => row.programId === pack.programId);
  return programLane(program?.name, store) === lane;
}

/** Canonical program label stored on the student so every lane filter stays in sync. */
export function resolveStudentProgramValue(raw?: string | null, store?: HirayaDatabase | null): string {
  const lane = specialtyLaneId(raw, store);
  return lane ? laneLabel(lane, store) : (raw || '').trim();
}
