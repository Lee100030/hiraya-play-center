import { hirayaApiUnavailable, proxyToHirayaApi } from '@/lib/server/backend';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const proxied = await proxyToHirayaApi(request, '/api/public/enrollment');
  if (proxied) {
    proxied.headers.set('Cache-Control', 'no-store');
    return proxied;
  }
  return hirayaApiUnavailable();
}
