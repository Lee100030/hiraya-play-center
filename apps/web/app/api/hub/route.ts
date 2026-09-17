import { NextResponse } from 'next/server';
import { proxyToHirayaApi } from '@/lib/server/backend';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const proxied = await proxyToHirayaApi(request, '/api/hub');
  if (proxied) return proxied;
  return NextResponse.json({
    name: 'HIRAYA Central API',
    hub: 'unavailable',
    error: 'Start Hiraya.Api on port 5188 so website, desktop, and mobile share one database.',
    clients: ['website', 'desktop', 'mobile'],
  }, { status: 503 });
}
