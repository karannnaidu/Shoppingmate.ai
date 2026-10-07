import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Sidebar, type SidebarStore } from '@/components/dashboard/Sidebar';
import { AlertBanner } from '@/components/dashboard/AlertBanner';
import { getDashboardSession, resolveOnboardingStep } from '@/lib/session';
import { getActiveAlert } from '@/lib/alerts-repo';
import { caseCounts } from '@/lib/cases-repo';
import { conversationsSince } from '@/lib/kpi-repo';
import { planCredits } from '@/lib/plan-credits';
import { isOpsAdmin } from '@/lib/support-tools';
import { isServiceBusiness } from '@/lib/business-type';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';

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

  const m = session.merchant;
  const [alert, used, counts, brand] = m
    ? await Promise.all([
        getActiveAlert(m.id),
        conversationsSince({ merchantId: m.id, days: 30 }).catch(() => 0),
        caseCounts(m.id).catch(() => ({ open: 0, urgentOpen: 0 })),
        db
          .select({
            name: merchants.name,
            domain: merchants.domain,
            brandSummary: merchants.brandSummary,
            brandCategories: merchants.brandCategories,
            businessType: merchants.businessType,
          })
          .from(merchants)
          .where(eq(merchants.id, m.id))
          .limit(1)
          .then((r) => r[0] ?? null)
          .catch(() => null),
      ])
    : [null, 0, { open: 0, urgentOpen: 0 }, null];

  const store: SidebarStore | undefined = m
    ? {
        name: m.name || m.domain || 'Your store',
        plan: m.plan,
        used,
        allowance: planCredits(m.plan).credits + (m.topupBalance ?? 0),
      }
    : undefined;

  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-text-primary md:flex-row">
      <div className="aurora opacity-30" aria-hidden />
      <Sidebar
        pathname={pathname}
        merchantId={m?.id}
        store={store}
        openRequests={counts.open}
        opsAdmin={isOpsAdmin(session.user.email)}
        service={isServiceBusiness(brand)}
      />
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <AlertBanner alert={alert as Parameters<typeof AlertBanner>[0]['alert']} />
        <main className="dash-enter mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}
