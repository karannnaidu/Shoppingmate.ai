import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { OnboardingWizard } from '@/components/dashboard/OnboardingWizard';

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const sp = await searchParams;
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session) redirect('/login');

  const step = Number(sp.step ?? '2');
  return <OnboardingWizard step={step} merchant={session.merchant as Parameters<typeof OnboardingWizard>[0]['merchant']} />;
}
