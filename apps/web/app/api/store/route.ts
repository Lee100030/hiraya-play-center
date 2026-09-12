import { NextResponse } from 'next/server';
import { SESSION_HEADER } from '@hiraya/config';
import { cloudSessionOk, loadStore, mysqlConfigured, saveEnrollmentStatuses } from '@/lib/server/mysql';
import type { HirayaDatabase } from '@hiraya/types';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
}

export async function GET(request: Request) {
  if (!mysqlConfigured()) return NextResponse.json({ error: 'Cloud database is not configured.' }, { status: 503 });
  if (!cloudSessionOk(request.headers.get(SESSION_HEADER))) return unauthorized();
  try {
    return NextResponse.json(await loadStore());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not load enrollments.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!mysqlConfigured()) return NextResponse.json({ error: 'Cloud database is not configured.' }, { status: 503 });
  if (!cloudSessionOk(request.headers.get(SESSION_HEADER))) return unauthorized();
  try {
    const body = (await request.json()) as HirayaDatabase;
    return NextResponse.json(await saveEnrollmentStatuses(body));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save enrollments.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
