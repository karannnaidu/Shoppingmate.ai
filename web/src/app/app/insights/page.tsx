import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { hasFeature } from '@shoppingmate/db/plans';
import { Button } from '@/components/ui/button';
import { getDashboardSession } from '@/lib/session';
import { loadInsights } from '@/lib/insights-repo';
import { type FixCard, deterministicFixes } from '@/lib/insights-fixes';
import {
  DEVICE_LABEL,
  FRICTION_LABEL,
  PAGE_LABEL,
  STEP_LABEL,
  elementWords,
  money,
  outOf100,
  pageSpeedWords,
  trendWords,
} from '@/lib/insights-copy';
import { markFix } from './actions';
import { AskBox } from './ask-box';
import { FixButton } from './fix-button';

// Nav PRD Phase 8.13 — Store Insights for SHOP OWNERS (not analysts): answer
// first, money and people, their own pages with pins, one action per insight.

const MIN_VISITS = 20;

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-border bg-surface p-5 ${className}`}>{children}</section>;
}

function Locked() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">Store Insights</h1>
      <Card>
        <p className="text-lg font-medium text-text-primary">See exactly why shoppers leave — and what to fix first.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-secondary">
          <li>Where people stop between your home page and checkout, in money lost each week</li>
          <li>Your own pages with pins on what people tap, ignore, or get stuck on</li>
          <li>What shoppers told your assistant: doubts, questions, products they wanted</li>
          <li>A short Monday email with the 3 things to fix this week</li>
        </ul>
        <p className="mt-3 text-sm text-text-secondary">Included in the Growth and Scale plans.</p>
        <Link href="/app/billing" className="mt-4 inline-block">
          <Button>See plans</Button>
        </Link>
      </Card>
    </div>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDashboardSession({ headers: await headers() });
  if (!session?.merchant) redirect('/app/onboarding?step=2');
  const m = { id: session.merchant.id, plan: session.merchant.plan };
  if (!hasFeature(m, 'insights')) return <Locked />;
  const sp = (await searchParams) ?? {};
  const qa = sp.qa === '1';
  const pageType = typeof sp.page === 'string' ? sp.page : 'pdp';
  const device = sp.device === 'mobile' ? 'mobile' : 'desktop';
  const { facts: f, report, screenshots } = await loadInsights(m.id, { qa });

  const enough = f.sessions >= MIN_VISITS;
  const atRisk = f.leaks.reduce((a, l) => a + l.valueAtRisk, 0);
  const fixes: FixCard[] = (report?.fixes?.length ? (report.fixes as FixCard[]) : deterministicFixes(f)).slice(0, 5);
  const openFixes = fixes.filter((x) => x.status !== 'done');
  const trend = trendWords(f.sessions, f.sessionsPrev);
  const summary =
    report?.summary ??
    (f.sessions === 0
      ? 'No visits measured yet — numbers appear here as soon as shoppers browse your store.'
      : `${f.sessions} people visited your store this week and ${f.steps.purchase} bought — ${outOf100(f.conversionRate)} visitors.`);

  const pageHeat = f.heat.filter((h) => h.pageType === pageType && h.device === device);
  const maxHeat = Math.max(1, ...pageHeat.map((h) => h.clicks));
  const pageAttn = f.attention.filter((a) => a.pageType === pageType && a.device === device);
  const maxAttn = Math.max(1, ...pageAttn.map((a) => a.seconds));
  const pageInfo = f.pages.find((p) => p.pageType === pageType);
  const pins = f.friction.filter((x) => x.pageType === pageType && x.kind !== 'uturn').slice(0, 4);
  const shot = screenshots[pageType]?.[device] ?? screenshots[pageType]?.desktop;
  const pageTypes = [...new Set(['home', 'pdp', 'plp', ...f.pages.map((p) => p.pageType)])].filter((t) => t !== 'other');
  const qs = (o: Record<string, string>) => `?${new URLSearchParams({ ...(qa ? { qa: '1' } : {}), page: pageType, device, ...o }).toString()}`;
  const steps = ['visit', 'product', 'add_to_cart', 'checkout', 'purchase'] as const;

  return (
    <div className="flex flex-col gap-6">
      {qa && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Showing test data from our automated check — not real shoppers.</p>
      )}

      {/* 1. Answer first */}
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">Your store this week</h1>
        <p className="mt-2 text-lg text-text-primary">{summary}</p>
        <p className="mt-1 text-sm text-text-secondary">
          {enough ? `Based on ${f.sessions} visits · ` : 'Too early to be sure — check back in a few days · '}
          <span className={trend.tone === 'bad' ? 'text-rose-400' : trend.tone === 'good' ? 'text-emerald-400' : ''}>
            Visits {trend.text}
          </span>
        </p>
      </div>

      {atRisk > 0 && (
        <Card className="border-amber-500/40">
          <p className="text-sm text-text-secondary">Left on the table this week</p>
          <p className="font-display text-3xl font-semibold text-amber-400">{money(atRisk, f.currency)}</p>
          <p className="mt-1 text-sm text-text-secondary">
            Shoppers who were on their way to buying and stopped. {f.aovSource === 'catalog' ? 'Valued at your typical product price.' : ''}
          </p>
        </Card>
      )}

      {/* 2. What to fix */}
      <section>
        <h2 className="font-display text-lg font-semibold text-text-primary">What to fix first</h2>
        {openFixes.length === 0 ? (
          <Card className="mt-3">
            <p className="text-text-secondary">Nothing urgent right now. We’ll flag the first thing that starts costing you sales.</p>
          </Card>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {fixes.slice(0, 3).map((x, i) => (
              <li key={x.id}>
                <Card>
                  <p className="text-xs uppercase tracking-wide text-text-secondary">
                    Fix {i + 1}
                    {x.impactValue ? ` · ${money(x.impactValue, f.currency)} a week` : ''}
                  </p>
                  <p className="mt-1 font-medium text-text-primary">{x.title}</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div>
                      <dt className="inline text-text-secondary">Why it matters: </dt>
                      <dd className="inline text-text-primary">{x.impact}</dd>
                    </div>
                    <div>
                      <dt className="inline text-text-secondary">How we know: </dt>
                      <dd className="inline text-text-primary">{x.proof}</dd>
                    </div>
                    <div>
                      <dt className="inline text-text-secondary">What to do: </dt>
                      <dd className="inline font-medium text-text-primary">{x.action}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {report && report.fixes.some((r) => r.id === x.id) && (
                      <form action={markFix}>
                        <input type="hidden" name="reportId" value={report.id} />
                        <input type="hidden" name="fixId" value={x.id} />
                        <input type="hidden" name="status" value={x.status === 'done' ? 'open' : 'done'} />
                        <FixButton done={x.status === 'done'} />
                      </form>
                    )}
                    {x.status === 'done' && <span className="text-sm text-emerald-400">Done — we’ll show next week whether it worked.</span>}
                    {x.pageType && (
                      <Link href={qs({ page: x.pageType })} className="text-sm text-violet hover:underline">
                        Show me on the page
                      </Link>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>

      <AskBox qa={qa} />

      {/* 3. Where shoppers leave */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-text-primary">Where shoppers leave</h2>
        {f.sessions === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">This fills in as people visit.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-1">
            {steps.map((s, i) => {
              const n = f.steps[s];
              const leak = i > 0 ? f.leaks.find((l) => l.to === s) : undefined;
              return (
                <li key={s}>
                  {leak && leak.lost > 0 && (
                    <p className="py-1 pl-3 text-sm text-amber-400">
                      ↓ {leak.lost} left here{leak.valueAtRisk ? ` · about ${money(leak.valueAtRisk, f.currency)}` : ''}
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="h-8 rounded bg-violet/30" style={{ width: `${Math.max(4, (n / Math.max(1, f.steps.visit)) * 100)}%` }} />
                    <span className="whitespace-nowrap text-sm text-text-primary">
                      {n} · {STEP_LABEL[s]}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {/* 4. Your pages */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-text-primary">Your pages</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {pageTypes.map((t) => (
            <Link
              key={t}
              href={qs({ page: t })}
              className={`rounded-full border px-3 py-1 text-sm ${t === pageType ? 'border-text-primary text-text-primary' : 'border-border text-text-secondary'}`}
            >
              {PAGE_LABEL[t] ?? t}
            </Link>
          ))}
          <span className="mx-1 text-border">|</span>
          {(['desktop', 'mobile'] as const).map((d) => (
            <Link
              key={d}
              href={qs({ device: d })}
              className={`rounded-full border px-3 py-1 text-sm ${d === device ? 'border-text-primary text-text-primary' : 'border-border text-text-secondary'}`}
            >
              {d === 'desktop' ? 'Computer' : 'Phone'}
            </Link>
          ))}
        </div>
        {pageInfo && (
          <p className="mt-3 text-sm text-text-secondary">
            {pageInfo.views} views · people stay {pageInfo.avgSeconds}s and see about {pageInfo.avgScroll}% of the page
            {pageSpeedWords(pageInfo.avgLcpMs) ? ` · it ${pageSpeedWords(pageInfo.avgLcpMs)}` : ''}
            {pageInfo.quickExits ? ` · ${pageInfo.quickExits} left within a few seconds` : ''}
          </p>
        )}
        {pins.length > 0 && (
          <ol className="mt-3 space-y-1 text-sm">
            {pins.map((p, i) => (
              <li key={`${p.kind}-${p.target}-${p.device}`} className="text-text-primary">
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs text-white">{i + 1}</span>
                {p.count} times people {FRICTION_LABEL[p.kind]} — {elementWords(p.target)} ({DEVICE_LABEL[p.device] ?? p.device})
              </li>
            ))}
          </ol>
        )}
        <div
          className="mt-4 max-h-[70vh] overflow-y-auto rounded-md border border-border"
          style={{ maxWidth: device === 'mobile' ? 360 : 720 }}
        >
        <div className="relative">
          {shot ? (
            // biome-ignore lint/a11y/useAltText: decorative page picture with overlay; described by the text above
            <img src={shot} alt={`${PAGE_LABEL[pageType] ?? pageType} screenshot`} className="block w-full" />
          ) : (
            <div className="aspect-[3/4] w-full bg-surface-muted" />
          )}
          {/* where people tapped: a circle per area, bigger = more taps */}
          <div className="pointer-events-none absolute inset-0">
            {pageHeat.map((h) => {
              const [x = 0, y = 0] = h.cell.split(',').map(Number);
              const size = 18 + 42 * (h.clicks / maxHeat);
              return (
                <span
                  key={h.cell}
                  className="absolute flex items-center justify-center rounded-full border-2 border-white/80 text-[10px] font-semibold text-white"
                  style={{
                    left: `${x * 10 + 5}%`,
                    top: `${y * 10 + 5}%`,
                    width: size,
                    height: size,
                    transform: 'translate(-50%, -50%)',
                    background: `rgba(244,63,94,${0.45 + 0.4 * (h.clicks / maxHeat)})`,
                  }}
                >
                  {h.clicks}
                </span>
              );
            })}
          </div>
          {/* how long people looked at each part (left strip) */}
          <div className="pointer-events-none absolute inset-y-0 left-0 flex w-2 flex-col">
            {Array.from({ length: 10 }, (_, b) => {
              const s = pageAttn.find((a) => a.band === b)?.seconds ?? 0;
              return <div key={b} className="flex-1" style={{ background: `rgba(139,92,246,${0.1 + 0.8 * (s / maxAttn)})` }} />;
            })}
          </div>
        </div>
        </div>
        <p className="mt-2 text-xs text-text-secondary">
          Red circles show where people tap (the number is how many taps); the purple strip shows where they spend
          time reading. Scroll inside the picture to see the whole page.
        </p>
      </Card>

      {/* 5. Products */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-text-primary">Your products</h2>
        {f.products.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">Fills in as people look at products.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-text-secondary">
                <tr>
                  <th className="py-1 pr-4 font-medium">Product page</th>
                  <th className="py-1 pr-4 font-medium">Looked at</th>
                  <th className="py-1 pr-4 font-medium">Added to cart</th>
                  <th className="py-1 font-medium">Out of 100 lookers</th>
                </tr>
              </thead>
              <tbody>
                {f.products.slice(0, 8).map((p) => (
                  <tr key={p.path} className="border-t border-border">
                    <td className="py-1 pr-4 text-text-primary">{p.path}</td>
                    <td className="py-1 pr-4">{p.views}</td>
                    <td className="py-1 pr-4">{p.addToCart}</td>
                    <td className="py-1">{Math.round(p.rate * 100)} add it</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 6. What shoppers are saying */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-text-primary">What shoppers are saying</h2>
        <p className="mt-1 text-sm text-text-secondary">From {f.voice.conversations} conversations with your assistant this week.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-text-primary">What made them hesitate</p>
            {f.voice.objections.length === 0 ? (
              <p className="text-sm text-text-secondary">Nothing came up yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {f.voice.objections.slice(0, 5).map((o) => (
                  <li key={o.text} className="text-text-primary">
                    {o.text} <span className="text-text-secondary">· {o.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">What they were looking for</p>
            {f.voice.needs.length === 0 ? (
              <p className="text-sm text-text-secondary">Nothing came up yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {f.voice.needs.slice(0, 5).map((o) => (
                  <li key={o.text} className="text-text-primary">
                    {o.text} <span className="text-text-secondary">· {o.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {f.voice.unanswered.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-text-primary">Questions your assistant couldn’t answer</p>
            <ul className="mt-1 space-y-1 text-sm text-text-primary">
              {f.voice.unanswered.slice(0, 5).map((u) => (
                <li key={u}>“{u}”</li>
              ))}
            </ul>
            <Link href="/app/knowledge" className="mt-2 inline-block text-sm text-violet hover:underline">
              Add an answer
            </Link>
          </div>
        )}
      </Card>

      {/* 7. Assistant impact */}
      <Card>
        <h2 className="font-display text-lg font-semibold text-text-primary">What your assistant did</h2>
        <p className="mt-2 text-sm text-text-primary">
          {f.bot.engagedSessions} visitors chatted with your assistant this week
          {f.bot.engagedPurchases + f.bot.otherPurchases > 0
            ? ` · ${f.bot.engagedPurchases} of ${f.bot.engagedPurchases + f.bot.otherPurchases} purchases came from people who chatted`
            : ''}
          .
        </p>
      </Card>

      {/* 8. Details for analysts (Scale) */}
      {hasFeature(m, 'insights_detail') && (
        <details className="rounded-lg border border-border bg-surface p-5">
          <summary className="cursor-pointer font-display text-lg font-semibold text-text-primary">Details</summary>
          <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-text-primary">Where visitors came from</p>
              <ul className="mt-1 space-y-1">
                {f.bySource.map((s) => (
                  <li key={s.source}>
                    {s.source}: {s.sessions} visits, {s.purchases} bought
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-text-primary">Devices</p>
              <ul className="mt-1 space-y-1">
                {f.byDevice.map((d) => (
                  <li key={d.device}>
                    {DEVICE_LABEL[d.device] ?? d.device}: {d.sessions} visits, {d.purchases} bought
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
