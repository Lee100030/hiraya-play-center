import { hirayaApiUnavailable, proxyToHirayaApi } from '@/lib/server/backend';
import { mysqlConfigured, submitEnrollment } from '@/lib/server/mysql';
import { NextResponse } from 'next/server';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const proxied = await proxyToHirayaApi(request, '/api/public/enrollment');
  if (proxied) return proxied;
  if (mysqlConfigured()) {
    try {
      const body = await request.json();
      return NextResponse.json(await submitEnrollment(body));
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Could not submit enrollment.' },
        { status: 400 },
      );
    }
  }
  return hirayaApiUnavailable();
}
