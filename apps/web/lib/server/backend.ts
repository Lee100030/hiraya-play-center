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

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Hiraya-Session, X-Hiraya-Client, Authorization, Accept',
  'Access-Control-Max-Age': '86400',
};

export function applyApiCors(headers: Headers) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
}

export function apiCorsPreflight() {
  const headers = new Headers();
  applyApiCors(headers);
  return new NextResponse(null, { status: 204, headers });
}

export function hirayaApiUnavailable() {
  const headers = new Headers();
  applyApiCors(headers);
  headers.set('Content-Type', 'application/json');
  return NextResponse.json(
    {
      error:
        'HIRAYA API is not connected. Set HIRAYA_API_INTERNAL (server) or NEXT_PUBLIC_API_URL to the Hiraya.Api URL, for example http://127.0.0.1:5188, then restart the website.',
      hub: 'unavailable',
    },
    { status: 503, headers },
  );
}

export async function proxyToHirayaApi(request: Request, path: string) {
  if (request.method === 'OPTIONS') return apiCorsPreflight();
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
    const res = await fetch(target, {
      ...init,
      signal: AbortSignal.timeout(50_000),
    });
    let body = await res.arrayBuffer();
    const type = res.headers.get('content-type') || '';
    if (type.includes('json') && body.byteLength) {
      try {
        const parsed = JSON.parse(new TextDecoder().decode(body)) as { error?: string };
        if (typeof parsed?.error === 'string' && /mysql/i.test(parsed.error)) {
          parsed.error = 'This email is already used at this center. Use a different parent email.';
          body = new TextEncoder().encode(JSON.stringify(parsed)).buffer as ArrayBuffer;
        }
      } catch {
        /* leave the original body */
      }
    }
    const out = new Headers();
    if (type) out.set('Content-Type', type);
    out.set('Cache-Control', 'no-store');
    out.set('X-Hiraya-Hub', 'hiraya-central');
    applyApiCors(out);
    return new NextResponse(body.byteLength ? body : null, { status: res.status, headers: out });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    console.error(`Hiraya.Api proxy failed (${target}):`, err instanceof Error ? err.message : err);
    if (timedOut) {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      applyApiCors(headers);
      return NextResponse.json(
        { error: 'The center is still waking up. Wait a moment and try again.' },
        { status: 503, headers },
      );
    }
    return null;
  }
}
