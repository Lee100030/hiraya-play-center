import { hirayaApiUnavailable, proxyToHirayaApi } from '@/lib/server/backend';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const proxied = await proxyToHirayaApi(request, '/api/public/site');
  if (proxied) return proxied;
  return hirayaApiUnavailable();
}
