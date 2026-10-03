import { hirayaApiUnavailable, proxyToHirayaApi } from '@/lib/server/backend';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const proxied = await proxyToHirayaApi(request, '/api/health');
  if (proxied) return proxied;
  return hirayaApiUnavailable();
}
