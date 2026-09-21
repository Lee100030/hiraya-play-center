import { NextResponse } from 'next/server';
import { backendBase, hirayaApiUnavailable, proxyToHirayaApi } from '@/lib/server/backend';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const proxied = await proxyToHirayaApi(request, '/api/health');
  if (proxied) return proxied;
  if (!backendBase()) return hirayaApiUnavailable();
  return NextResponse.json(
    {
      error: 'Hiraya.Api is not reachable. Set HIRAYA_API_INTERNAL on Vercel to the API origin.',
      hub: 'unavailable',
    },
    { status: 503 },
  );
}
