import { NextResponse } from 'next/server';
import { mysqlConfigured, submitEnrollment } from '@/lib/server/mysql';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!mysqlConfigured()) {
    return NextResponse.json(
      { error: 'Enrollment is not connected to the cloud database yet.' },
      { status: 503 },
    );
  }
  try {
    const body = await request.json();
    return NextResponse.json(await submitEnrollment(body));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not submit enrollment.';
    const status = /already waiting/i.test(message) || /complete the enrollment/i.test(message) || /required|valid|Select/i.test(message)
      ? 400
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
