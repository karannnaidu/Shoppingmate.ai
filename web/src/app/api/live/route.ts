import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/session';
import { liveSnapshot } from '@/lib/live-repo';

export async function GET() {
  const session = await getDashboardSession({ headers: await headers() });
  if (!session?.merchant) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await liveSnapshot(session.merchant.id));
}
