import { NextResponse } from 'next/server';
import { loadPublicSite, mysqlConfigured } from '@/lib/server/mysql';
import { publicDefaults } from '@/lib/publicSite';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!mysqlConfigured()) {
    return NextResponse.json(publicDefaults);
  }
  try {
    return NextResponse.json(await loadPublicSite());
  } catch {
    return NextResponse.json(publicDefaults);
  }
}
