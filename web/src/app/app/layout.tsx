import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { AlertBanner } from '@/components/dashboard/AlertBanner';
import { getDashboardSession, resolveOnboardingStep } from '@/lib/session';
import { getActiveAlert } from '@/lib/alerts-repo';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });

  if (!session) redirect('/login');

  const step = resolveOnboardingStep(session.merchant);
  const pathname = hdrs.get('x-pathname') ?? '/app';

  if (step !== '/app' && !pathname.startsWith('/app/onboarding')) {
    redirect(step);
  }

  const alert = session.merchant ? await getActiveAlert(session.merchant.id) : null;

  return (
    <div className="relative flex min-h-dvh bg-background text-text-primary">
      <div className="aurora opacity-40" aria-hidden />
      <Sidebar pathname={pathname} merchantId={session.merchant?.id} />
      <div className="relative z-10 flex-1 flex flex-col">
        <AlertBanner alert={alert as Parameters<typeof AlertBanner>[0]['alert']} />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
