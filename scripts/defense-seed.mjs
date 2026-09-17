/**
 * Defense demo data: center contact, parent↔child links, a few modules.
 * Usage: node scripts/defense-seed.mjs
 */
const API = process.env.HIRAYA_API_URL || 'http://127.0.0.1:5188';
const LOGIN = process.env.HIRAYA_ADMIN_LOGIN || 'admin';
const PASSWORD = process.env.HIRAYA_ADMIN_PASSWORD || 'Admin123';

const CONTACT = {
  address: 'Rodriguez (Montalban), Rizal, Philippines',
  phone: '+63 917 753 4258',
  email: 'hirayakids.learning@gmail.com',
  businessHours: 'Monday–Friday, 8:00–17:00',
};

async function parse(res) {
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }
  if (!res.ok) {
    throw new Error(body?.error || body?.message || `${res.status} ${res.statusText}`);
  }
  return body;
}

async function main() {
  const session = await parse(
    await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: LOGIN, password: PASSWORD }),
    }),
  );
  const token = session.token;
  if (!token) throw new Error('Login did not return a session token.');
  const headers = {
    'Content-Type': 'application/json',
    'X-Hiraya-Session': token,
  };

  const store = await parse(await fetch(`${API}/api/store`, { headers }));
  const settings = store.settings || {};
  const nextSettings = {
    ...settings,
    address: String(settings.address || '').trim() || CONTACT.address,
    phone: String(settings.phone || '').trim() || CONTACT.phone,
    email: String(settings.email || '').trim() || CONTACT.email,
    businessHours: String(settings.businessHours || '').trim() || CONTACT.businessHours,
    updatedAt: new Date().toISOString(),
  };

  const parents = (store.users || []).filter((u) => String(u.role).toLowerCase() === 'parent');
  const parent =
    parents.find((u) => /^parent$/i.test(u.username || '')) ||
    parents.find((u) => /parent@hiraya\.local/i.test(u.email || '')) ||
    parents[0];
  if (!parent) throw new Error('No parent account found. Create one in Admin → Parents first.');

  const names = ['aaliyah', 'james'];
  const kids = (store.students || []).filter((s) => {
    const hay = `${s.firstName || ''} ${s.lastName || ''} ${s.fullname || ''}`.toLowerCase();
    return names.some((n) => hay.includes(n));
  });
  const pick = kids.length ? kids.slice(0, 3) : (store.students || []).slice(0, 2);
  if (!pick.length) throw new Error('No students to link.');

  const students = (store.students || []).map((s) =>
    pick.some((k) => k.studentId === s.studentId) ? { ...s, parentId: parent.userId } : s,
  );

  let modules = store.learningModules || [];
  if (!modules.length) {
    const now = new Date().toISOString();
    const programId = store.programs?.[0]?.programId || '';
    modules = [
      {
        moduleId: 'mod_defense_play',
        title: 'Morning circle & play',
        description: 'Opening routine, name songs, and free play for the first period.',
        programId,
        subject: 'Social',
        gradeLevel: 'Pre-K',
        moduleType: 'lesson',
        classIds: [],
        currentVersionId: '',
        version: '1',
        status: 'published',
        fileName: '',
        filePath: '',
        fileType: '',
        fileSize: 0,
        uploadedByUserId: session.user?.userId || '',
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
        archivedAt: '',
      },
      {
        moduleId: 'mod_defense_letters',
        title: 'Letter sounds',
        description: 'Guided phonics practice with picture cards.',
        programId,
        subject: 'Literacy',
        gradeLevel: 'Kinder',
        moduleType: 'lesson',
        classIds: [],
        currentVersionId: '',
        version: '1',
        status: 'published',
        fileName: '',
        filePath: '',
        fileType: '',
        fileSize: 0,
        uploadedByUserId: session.user?.userId || '',
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
        archivedAt: '',
      },
      {
        moduleId: 'mod_defense_count',
        title: 'Count to ten',
        description: 'Hands-on counting with classroom objects.',
        programId,
        subject: 'Numeracy',
        gradeLevel: 'Kinder',
        moduleType: 'lesson',
        classIds: [],
        currentVersionId: '',
        version: '1',
        status: 'published',
        fileName: '',
        filePath: '',
        fileType: '',
        fileSize: 0,
        uploadedByUserId: session.user?.userId || '',
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
        archivedAt: '',
      },
    ];
  }

  await parse(
    await fetch(`${API}/api/store`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ...store, settings: nextSettings, students, learningModules: modules }),
    }),
  );

  for (const child of pick) {
    const res = await fetch(`${API}/api/admin/parents/${encodeURIComponent(parent.userId)}/children`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ studentId: child.studentId, relationship: 'Guardian' }),
    });
    if (!res.ok && res.status !== 409) {
      const text = await res.text();
      console.warn(`Link ${child.fullname || child.firstName}: ${res.status} ${text}`);
    }
  }

  console.log(`Linked ${pick.map((s) => s.fullname || `${s.firstName} ${s.lastName}`).join(', ')} → ${parent.fullname || parent.username}`);
  console.log(`Parent login to demo: username "${parent.username}" (seed parent / Parent123 if that account).`);
  console.log('Center contact and modules updated.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
