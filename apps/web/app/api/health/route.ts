import { NextResponse } from 'next/server';
import { mysqlConfigured } from '@/lib/server/mysql';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: mysqlConfigured() ? 'ok' : 'unconfigured',
    database: mysqlConfigured() ? 'cloud' : 'none',
  });
}
