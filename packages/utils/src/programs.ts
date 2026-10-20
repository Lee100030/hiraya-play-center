import type { HirayaDatabase, LearningProgram } from '@hiraya/types';
import { laneLabel, managementLanesFor, programLane, studentInLane } from './managementLanes';
import { placeStudentSessionPackage, studentSessionAccount, studentSessionPackage, upsertStudentSessions } from './sessionPackage';

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function addLearningProgram(store: HirayaDatabase, name: string, description = '') {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Enter a program name.');
  const existing = (store.programs || []).find((row) => row.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return { store, program: existing, created: false as const };
  const program: LearningProgram = {
    programId: newId('prg'),
    name: trimmed,
    description: description.trim(),
    status: 'active',
    tuitionFee: 0,
  };
  return {
    store: { ...store, programs: [...(store.programs || []), program] },
    program,
    created: true as const,
  };
}

function pesos(value: number | string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(Math.max(0, amount) * 100) / 100;
}

export function programForLane(store: HirayaDatabase, laneId?: string | null): LearningProgram | undefined {
  const lane = (laneId || '').trim();
  if (!lane) return undefined;
  const label = (laneLabel(lane, store) || lane).trim().toLowerCase();
  return (store.programs || []).find((program) => {
    if ((program.status || '').toLowerCase() === 'archived') return false;
    if ((program.programId || '').trim() === lane) return true;
    const name = (program.name || '').trim().toLowerCase();
    if (name === label) return true;
    return programLane(program.name, store) === lane;
  });
}

function programFromLabel(store: HirayaDatabase, raw?: string | null): LearningProgram | undefined {
  const label = (raw || '').trim();
  if (!label) return undefined;
  const lane = programLane(label, store);
  if (!lane) return undefined;
  const program = programForLane(store, lane);
  if (!program || (program.status || '').toLowerCase() === 'archived') return undefined;
  return program;
}

/** The program-tuition row for this student. Class times such as "Playgroup 1:30-3:00" use the Playgroup fee. */
export function programForStudent(store: HirayaDatabase, studentId: string): LearningProgram | undefined {
  const id = (studentId || '').trim().toLowerCase();
  if (!id) return undefined;
  const student = (store.students || []).find((row) => (row.studentId || '').trim().toLowerCase() === id);
  const enrollment = (store.enrollments || []).find((row) => {
    const status = (row.status || '').trim().toLowerCase();
    return (row.studentId || '').trim().toLowerCase() === id && !['cancelled', 'canceled', 'archived'].includes(status);
  });
  const cls = enrollment?.classId
    ? (store.classes || []).find((row) => row.classId === enrollment.classId)
    : undefined;
  const byId = (programId?: string | null) =>
    (store.programs || []).find(
      (program) =>
        program.programId === (programId || '').trim() && (program.status || '').toLowerCase() !== 'archived',
    );
  const enrolled = byId(enrollment?.programId) || byId(cls?.programId);
  if (enrolled) return enrolled;
  const enrolledName = enrollment?.programId
    ? (store.programs || []).find((row) => row.programId === enrollment.programId)?.name
    : '';
  const classProgramName = cls?.programId
    ? (store.programs || []).find((row) => row.programId === cls.programId)?.name
    : '';
  const labels = [student?.program, student?.gradeLevel, cls?.name, classProgramName, enrolledName];
  for (const label of labels) {
    const named = (store.programs || []).find(
      (program) =>
        (program.status || '').toLowerCase() !== 'archived' &&
        (program.name || '').trim().toLowerCase() === (label || '').trim().toLowerCase(),
    );
    if (named) return named;
    const program = programFromLabel(store, label);
    if (program) return program;
  }
  if (!enrollment?.programId) return undefined;
  return programForLane(store, enrollment.programId);
}

export function saveProgramTuition(store: HirayaDatabase, laneId: string, amountInput: number | string): HirayaDatabase {
  const fee = pesos(amountInput);
  let next = store;
  let program = programForLane(next, laneId);
  if (!program) {
    const added = addLearningProgram(next, laneLabel(laneId, store) || laneId);
    next = added.store;
    program = added.program;
  }
  const programId = program.programId;
  return {
    ...next,
    programs: (next.programs || []).map((row) => (row.programId === programId ? { ...row, tuitionFee: fee } : row)),
  };
}

function wholeSessions(value: number | string) {
  const count = Math.floor(Number(value));
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, count);
}

function statusForRemaining(remaining: number) {
  if (remaining <= 0) return 'completed';
  if (remaining <= 2) return 'almost_finished';
  return 'active';
}

/**
 * Set how many sessions are in this program’s package.
 * Every learner in the lane gets that total. Sessions already used stay used.
 */
export function assignLaneSessionPackage(store: HirayaDatabase, laneId: string, totalInput: number | string): HirayaDatabase {
  const total = wholeSessions(totalInput);
  if (total < 1) throw new Error('Enter how many sessions are in this package.');
  const lane = (laneId || '').trim();
  if (!lane) throw new Error('Choose a program first.');
  let next = store;
  let program = programForLane(next, lane);
  if (!program) {
    const added = addLearningProgram(next, laneLabel(lane, store) || lane);
    next = added.store;
    program = added.program;
  }
  const programId = program.programId;
  next = {
    ...next,
    programs: (next.programs || []).map((row) => (row.programId === programId ? { ...row, packageSessions: total } : row)),
  };
  const students = (next.students || []).filter((student) => studentInLane(next, student, lane));
  for (const student of students) {
    const account = studentSessionAccount(next, student.studentId);
    const used = account.hasPackage ? account.used : 0;
    const remaining = Math.max(0, total - used);
    next = upsertStudentSessions(next, student.studentId, remaining, total, programId);
    const row = studentSessionPackage(next, student.studentId);
    if (!row) continue;
    const status = statusForRemaining(remaining);
    if (row.status !== status || row.programId !== programId) {
      next = placeStudentSessionPackage(next, { ...row, programId, status });
    }
  }
  return next;
}

export function moduleTuitionLanes(store: HirayaDatabase, laneId?: string | null) {
  const lanes = laneId ? managementLanesFor(store).filter((lane) => lane.id === laneId) : managementLanesFor(store);
  return lanes.map((lane) => {
    const program = programForLane(store, lane.id);
    return {
      id: lane.id,
      label: lane.label,
      tuitionFee: program ? pesos(program.tuitionFee || 0) : null,
    };
  });
}

export function removeLearningProgram(store: HirayaDatabase, programId: string) {
  const id = (programId || '').trim();
  if (!id) throw new Error('That program was not found.');
  const program = (store.programs || []).find((row) => row.programId === id);
  if (!program) throw new Error('That program was not found.');
  return {
    store: {
      ...store,
      programs: (store.programs || []).filter((row) => row.programId !== id),
    },
    program,
  };
}
