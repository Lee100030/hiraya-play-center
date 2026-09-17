import { hirayaApiUnavailable, proxyToHirayaApi } from '@/lib/server/backend';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const proxied = await proxyToHirayaApi(request, '/api/messages');
  return proxied || hirayaApiUnavailable();
}
