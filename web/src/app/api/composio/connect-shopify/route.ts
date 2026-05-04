import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardSession } from '@/lib/session';
import { startShopifyConnection } from '@/lib/composio';

export async function POST() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!session.merchant) return NextResponse.json({ error: 'no merchant' }, { status: 400 });

  const { authUrl, connectionId } = await startShopifyConnection({
    userId: session.user.id,
    merchantId: session.merchant.id,
  });
  return NextResponse.json({ auth_url: authUrl, connection_id: connectionId });
}
