import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/session';

export async function GET(_req: Request) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({
    id: session.merchant.id,
    status: session.merchant.status,
    billingStatus: session.merchant.billingStatus,
    knowledgeBaseStatus: session.merchant.knowledgeBaseStatus,
    lastWidgetPing: session.merchant.lastWidgetPing,
  });
}
