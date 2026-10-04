import { hirayaApiUnavailable, proxyToHirayaApi } from '@/lib/server/backend';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const headers = new Headers(request.headers);
  const agent = headers.get('user-agent') || '';
  if (headers.get('x-hiraya-client') === 'mobile' || /okhttp|dalvik|expo/i.test(agent))
    headers.set('x-hiraya-client', 'mobile');
  const tagged = new Request(request.url, {
    method: 'POST',
    headers,
    body: await request.arrayBuffer(),
  });
  const proxied = await proxyToHirayaApi(tagged, '/api/auth/login');
  return proxied || hirayaApiUnavailable();
}
