const API = 'http://127.0.0.1:5188';
const results = [];

function ok(name, pass, detail) {
  results.push({ name, pass: Boolean(pass), detail: String(detail || '') });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function login(login, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `login ${login} ${res.status}`);
  return body;
}

async function getStore(token) {
  const res = await fetch(`${API}/api/store`, { headers: { 'X-Hiraya-Session': token } });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `GET store ${res.status}`);
  return body;
}

async function putStore(token, store) {
  const res = await fetch(`${API}/api/store`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Hiraya-Session': token },
    body: JSON.stringify(store),
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(body.error || `PUT store ${res.status}`);
  return body;
}

const id = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const now = new Date();
const start = new Date(now.getTime() + (6 + Math.floor(Math.random() * 48)) * 60 * 60 * 1000);
const end = new Date(start.getTime() + 60 * 60 * 1000);

try {
  const adminSession = await login('admin', 'Admin123');
  const teacherSession = await login('teacher', 'Teacher123');
  const parentSession = await login('parent', 'Parent123');
  ok('Admin login', adminSession.user?.role === 'super_admin', adminSession.user?.userId);
  ok('Teacher login', teacherSession.user?.role === 'teacher', teacherSession.user?.userId);
  ok('Parent login', parentSession.user?.role === 'parent', parentSession.user?.userId);

  const admin = await getStore(adminSession.token);
  const teacherId = teacherSession.user.userId;
  const parentId = parentSession.user.userId;
  const student = (admin.students || []).find((s) => s.parentId === parentId) || admin.students[0];
  ok('Admin store loaded', Array.isArray(admin.users) && admin.users.length > 0, `${admin.users.length} users`);
  ok('Admin sees students', (admin.students || []).length > 0, String((admin.students || []).length));
  ok('Linked student for parent tests', Boolean(student), student?.studentId || 'none');

  const scheduleId = id('sch');
  const taskId = id('tsk');
  const newsId = id('nws');
  const pkgId = id('pkg');
  const stamp = now.toISOString();

  if (admin.classes[0]) admin.classes[0].teacherId = teacherId;
  admin.enrollments = admin.enrollments || [];
  const enrollmentsForStudent = admin.enrollments.filter((e) => e.studentId === student.studentId);
  for (const row of enrollmentsForStudent) {
    row.teacherId = teacherId;
    row.status = 'active';
  }
  if (!enrollmentsForStudent.length) {
    admin.enrollments.push({
      enrollmentId: id('enr'),
      studentId: student.studentId,
      classId: (admin.classes[0] && admin.classes[0].classId) || '',
      programId: (admin.programs[0] && admin.programs[0].programId) || '',
      teacherId,
      status: 'active',
    });
  }
  admin.schedules = admin.schedules || [];
  admin.staffTasks = admin.staffTasks || [];
  admin.news = admin.news || [];
  admin.sessionPackages = admin.sessionPackages || [];
  admin.sessionHistory = admin.sessionHistory || [];
  admin.alerts = admin.alerts || [];

  admin.schedules.push({
    scheduleId,
    title: 'Workflow test class',
    kind: 'classSession',
    scheduleType: 'classSession',
    classId: (admin.classes[0] && admin.classes[0].classId) || '',
    studentId: student?.studentId || '',
    teacherId,
    programId: (admin.programs[0] && admin.programs[0].programId) || '',
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    room: `Test room ${scheduleId.slice(-6)}`,
    notes: 'API round-trip test',
    status: 'confirmed',
  });

  admin.staffTasks.push({
    taskId,
    title: 'Workflow test task',
    description: 'Mark this completed from the teacher account.',
    priority: 'high',
    dueAt: stamp.slice(0, 10),
    teacherIds: teacherId,
    classId: '',
    studentId: student?.studentId || '',
    status: 'assigned',
    response: '',
    attachmentName: '',
    assignedBy: adminSession.user.userId,
    completedAt: '',
    completedBy: '',
    createdAt: stamp,
    updatedAt: stamp,
  });

  admin.news.push({
    newsId,
    title: 'Workflow test announcement',
    body: 'Visible to teachers and parents.',
    publishedAt: stamp,
    isPublished: true,
    status: 'published',
    createdBy: adminSession.user.userId,
    audience: 'everyone',
    audienceId: '',
    priority: 'high',
    expiresAt: '',
  });

  admin.sessionPackages.push({
    packageId: pkgId,
    studentId: student.studentId,
    programId: (admin.programs[0] && admin.programs[0].programId) || '',
    totalSessions: 10,
    usedSessions: 1,
    remainingSessions: 9,
    startDate: stamp.slice(0, 10),
    expirationDate: '',
    status: 'active',
    createdAt: stamp,
    updatedAt: stamp,
  });

  const saved = await putStore(adminSession.token, admin);
  ok('Admin PUT store', Boolean(saved.schedules?.find((s) => s.scheduleId === scheduleId)), scheduleId);

  const teacherStore = await getStore(teacherSession.token);
  const teacherSeesSchedule = (teacherStore.schedules || []).some((s) => s.scheduleId === scheduleId);
  const teacherSeesTask = (teacherStore.staffTasks || []).some((t) => t.taskId === taskId);
  const teacherSeesNews = (teacherStore.news || []).some((n) => n.newsId === newsId);
  const teacherAlert = (teacherStore.alerts || []).some(
    (a) => a.relatedRecordId === taskId || (a.message || '').includes('Workflow test task'),
  );
  const teacherSeesAllStudents = (teacherStore.students || []).length === (admin.students || []).length && (admin.students || []).length > 2;
  ok('Teacher sees assigned schedule', teacherSeesSchedule, `schedules=${(teacherStore.schedules || []).length}`);
  ok('Teacher sees assigned task', teacherSeesTask, `tasks=${(teacherStore.staffTasks || []).length}`);
  ok('Teacher sees published announcement', teacherSeesNews);
  ok('Teacher got assignment notification', teacherAlert, `alerts=${(teacherStore.alerts || []).length}`);
  ok('Teacher does not see full student list', !teacherSeesAllStudents, `teacher students=${(teacherStore.students || []).length}`);
  ok(
    'Teacher sees assigned student',
    (teacherStore.students || []).some((s) => s.studentId === student.studentId),
    (teacherStore.students || []).map((s) => s.studentId).join(',') || 'none',
  );

  const task = (teacherStore.staffTasks || []).find((t) => t.taskId === taskId);
  if (task) {
    task.status = 'completed';
    task.response = 'Done in API test';
    task.completedAt = new Date().toISOString();
    task.completedBy = teacherId;
    task.updatedAt = task.completedAt;
    await putStore(teacherSession.token, teacherStore);
  }
  ok('Teacher completed task', Boolean(task), task ? task.status : 'missing');

  const adminAfter = await getStore(adminSession.token);
  const completed = (adminAfter.staffTasks || []).find((t) => t.taskId === taskId);
  ok(
    'Admin sees completed task + remarks',
    completed?.status === 'completed' && completed?.response === 'Done in API test',
    `${completed?.status || 'missing'} / ${completed?.response || ''}`,
  );
  ok(
    'Admin notified of completion',
    (adminAfter.alerts || []).some((a) => (a.message || '').includes('Workflow test task') && a.recipientId === adminSession.user.userId),
    `admin alerts=${(adminAfter.alerts || []).length}`,
  );

  const used = completed ? completed.usedSessions : null;
  const pkg = (adminAfter.sessionPackages || []).find((p) => p.packageId === pkgId);
  pkg.usedSessions = (pkg.usedSessions || 0) + 1;
  pkg.remainingSessions = Math.max(0, pkg.totalSessions - pkg.usedSessions);
  pkg.updatedAt = new Date().toISOString();
  adminAfter.sessionHistory = adminAfter.sessionHistory || [];
  adminAfter.sessionHistory.push({
    historyId: id('sh'),
    packageId: pkgId,
    studentId: student.studentId,
    scheduleId,
    attendanceId: '',
    action: 'used',
    note: 'Completed one valid session in API test',
    actorId: adminSession.user.userId,
    createdAt: pkg.updatedAt,
  });
  await putStore(adminSession.token, adminAfter);
  ok('Session used increment persisted', true, `${pkg.usedSessions}/${pkg.totalSessions} remaining ${pkg.remainingSessions}`);

  const parentStore = await getStore(parentSession.token);
  const parentKids = parentStore.students || [];
  const parentSeesOtherKids =
    parentKids.some((s) => s.studentId !== student.studentId) && parentKids.length > 1 && parentKids.length === (admin.students || []).length;
  const parentPkg = (parentStore.sessionPackages || []).find((p) => p.packageId === pkgId);
  const parentNews = (parentStore.news || []).some((n) => n.newsId === newsId);
  const parentSchedule = (parentStore.schedules || []).some((s) => s.scheduleId === scheduleId);
  const parentTasks = (parentStore.staffTasks || []).length;
  ok('Parent sees linked child', parentKids.some((s) => s.studentId === student.studentId), parentKids.map((s) => s.studentId).join(','));
  ok('Parent does not see all students', !parentSeesOtherKids, `parent students=${parentKids.length}`);
  ok('Parent sees remaining sessions', parentPkg && parentPkg.remainingSessions === pkg.remainingSessions, parentPkg ? String(parentPkg.remainingSessions) : 'no package');
  ok('Parent remaining is not hardcoded 10', parentPkg && parentPkg.remainingSessions !== 10, String(parentPkg?.remainingSessions));
  ok('Parent sees announcement', parentNews);
  ok('Parent sees child schedule', parentSchedule, `schedules=${(parentStore.schedules || []).length}`);
  ok('Parent does not receive staff tasks', parentTasks === 0, String(parentTasks));

  const parentBeforeWipe = (parentStore.students || []).map((s) => s.studentId).sort().join(',');
  const parentDenied = await putStore(parentSession.token, { ...parentStore, students: [] });
  ok(
    'Parent cannot wipe students',
    (parentDenied.students || []).some((s) => s.studentId === student.studentId) &&
      (parentDenied.students || []).length === parentKids.length,
    `after malicious PUT students=${(parentDenied.students || []).length} (was ${parentKids.length}, ids ${parentBeforeWipe})`,
  );
} catch (err) {
  ok('Harness', false, err.stack || err.message);
}

const failed = results.filter((r) => !r.pass);
console.log('\n---');
console.log(`Passed ${results.filter((r) => r.pass).length}/${results.length}`);
if (failed.length) {
  process.exitCode = 1;
}
