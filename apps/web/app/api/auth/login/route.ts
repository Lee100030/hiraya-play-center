import { NextResponse } from 'next/server';
import { loginWithMysql, mysqlConfigured } from '@/lib/server/mysql';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!mysqlConfigured()) {
    return NextResponse.json({ error: 'Cloud database is not configured.' }, { status: 503 });
  }
  try {
    const body = (await request.json()) as { login?: string; password?: string };
    return NextResponse.json(await loginWithMysql(body.login || '', body.password || ''));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid username or password.';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
