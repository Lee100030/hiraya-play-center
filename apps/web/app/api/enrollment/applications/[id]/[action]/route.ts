import { hirayaApiUnavailable, proxyToHirayaApi } from '@/lib/server/backend';
import { NextResponse } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await context.params;
  if (!['approve', 'reject', 'cancel', 'interview'].includes(action)) {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 404 });
  }
  const proxied = await proxyToHirayaApi(request, `/api/enrollment/applications/${id}/${action}`);
  return proxied || hirayaApiUnavailable();
}
