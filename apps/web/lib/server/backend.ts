import { CENTRAL_API_DEFAULT, SESSION_HEADER } from '@hiraya/config';
import { NextResponse } from 'next/server';

export function backendBase() {
  const fromEnv = (
    process.env.HIRAYA_API_INTERNAL ||
    process.env.HIRAYA_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_URL ||
    ''
  ).replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const vercelProduction = Boolean(process.env.VERCEL) && process.env.VERCEL_ENV === 'production';
  if (vercelProduction) return '';
  return CENTRAL_API_DEFAULT;
}

export function hirayaApiUnavailable() {
  return NextResponse.json(
    {
      error:
        'HIRAYA API is not connected. Set HIRAYA_API_INTERNAL (server) or NEXT_PUBLIC_API_URL to the Hiraya.Api URL, for example http://127.0.0.1:5188, then restart the website.',
      hub: 'unavailable',
    },
    { status: 503 },
  );
}

export async function proxyToHirayaApi(request: Request, path: string) {
  const base = backendBase();
  if (!base) return null;
  const incoming = new URL(request.url);
  const target = `${base}${path.startsWith('/') ? path : `/${path}`}${incoming.search}`;
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  const session = request.headers.get(SESSION_HEADER);
  if (session) headers.set(SESSION_HEADER, session);
  const phone = request.headers.get('x-hiraya-client');
  if (phone) headers.set('X-Hiraya-Client', phone);
  const init: RequestInit = { method: request.method, headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }
  try {
    const res = await fetch(target, init);
    const body = await res.arrayBuffer();
    const out = new Headers();
    const type = res.headers.get('content-type');
    if (type) out.set('Content-Type', type);
    const cache = res.headers.get('cache-control');
    if (cache) out.set('Cache-Control', cache);
    out.set('X-Hiraya-Hub', 'hiraya-central');
    return new NextResponse(body.byteLength ? body : null, { status: res.status, headers: out });
  } catch (err) {
    console.error(`Hiraya.Api proxy failed (${target}):`, err instanceof Error ? err.message : err);
    return null;
  }
}
