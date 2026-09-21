import { hirayaApiUnavailable, proxyToHirayaApi } from '@/lib/server/backend';
import { NextRequest } from 'next/server';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const joined = `/api/${(path || []).join('/')}`;
  const proxied = await proxyToHirayaApi(request, joined);
  if (proxied) return proxied;
  return hirayaApiUnavailable();
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
