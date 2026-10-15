import { hirayaApiUnavailable, proxyToHirayaApi } from '@/lib/server/backend';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const proxied = await proxyToHirayaApi(request, '/api/public/inquiries');
  if (proxied) return proxied;
  return hirayaApiUnavailable();
}
