import { proxyToHirayaApi } from '@/lib/server/backend';
import { mysqlConfigured } from '@/lib/server/mysql';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const proxied = await proxyToHirayaApi(request, '/api/health');
  if (proxied) return proxied;
  if (mysqlConfigured()) {
    return NextResponse.json({
      status: 'ok',
      hub: 'vercel-mysql',
      database: 'hiraya_learning_center',
      clients: ['website'],
    });
  }
  return NextResponse.json(
    {
      status: 'unconfigured',
      hub: 'unavailable',
      database: 'none',
      error:
        'Hiraya.Api is not reachable. For local work run npm run dev:api. On Vercel set HIRAYA_MYSQL (Aiven) or HIRAYA_API_INTERNAL.',
    },
    { status: 503 },
  );
}
