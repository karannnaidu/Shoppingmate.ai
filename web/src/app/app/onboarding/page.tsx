import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { OnboardingWizard } from '@/components/dashboard/OnboardingWizard';

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string; plan?: string }> }) {
  const sp = await searchParams;
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session) redirect('/login');

  const step = Number(sp.step ?? '2');
  const plan = sp.plan === 'growth' || sp.plan === 'scale' ? sp.plan : 'starter';
  return (
    <OnboardingWizard
      step={step}
      initialPlan={plan}
      merchant={session.merchant as Parameters<typeof OnboardingWizard>[0]['merchant']}
    />
  );
}
