import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Hiraya-Session, X-Hiraya-Client, Authorization, Accept',
  'Access-Control-Max-Age': '86400',
};

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) return NextResponse.next();

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(CORS)) response.headers.set(key, value);
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
