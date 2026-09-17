import { proxyToHirayaApi } from '@/lib/server/backend';
import { loadPublicSite, mysqlConfigured } from '@/lib/server/mysql';
import { publicDefaults, withPublicFallback } from '@/lib/publicSite';
import { NextResponse } from 'next/server';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const proxied = await proxyToHirayaApi(request, '/api/public/site');
  if (proxied) return proxied;
  if (mysqlConfigured()) {
    try {
      return NextResponse.json(withPublicFallback(await loadPublicSite()));
    } catch (err) {
      console.error('Public site MySQL fallback failed:', err instanceof Error ? err.message : err);
    }
  }
  return NextResponse.json(withPublicFallback(publicDefaults));
}
