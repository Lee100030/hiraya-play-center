import { hirayaApiUnavailable, proxyToHirayaApi } from '@/lib/server/backend';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const proxied = await proxyToHirayaApi(request, `/api/${path.join('/')}`);
  return proxied || hirayaApiUnavailable();
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
