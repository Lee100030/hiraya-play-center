import { hirayaApiUnavailable, proxyToHirayaApi } from '@/lib/server/backend';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const proxied = await proxyToHirayaApi(request, '/api/store');
  return proxied || hirayaApiUnavailable();
}

export async function PUT(request: Request) {
  const proxied = await proxyToHirayaApi(request, '/api/store');
  return proxied || hirayaApiUnavailable();
}
