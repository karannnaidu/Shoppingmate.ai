'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PLAN_CREDITS } from '@/lib/plan-credits';
import { FAQ_ITEMS } from '@/components/Faq';
import { AccentButton, Container, Eyebrow, H2, InkButton, Lead, Reveal, TalkButton } from './ui';

const TIERS = [
  {
    key: 'starter',
    name: 'Starter',
    who: 'For a store finding its feet.',
    features: ['Voice + chat on every page', 'Cart, discount-code and checkout help', 'Customer requests sent to your inbox', 'Dashboard with every conversation', 'Trained on your products and policies'],
  },
  {
    key: 'growth',
    name: 'Growth',
    who: 'Know why shoppers leave — and fix it.',
    popular: true,
    features: ['Everything in Starter', 'Store Insights: where shoppers get stuck', 'Weekly list of fixes, in plain English', 'Heatmaps by page type', 'Weekly Insights email · 50,000 tracked visits/mo'],
  },
  {
    key: 'scale',
    name: 'Scale',
    who: 'High traffic and a team to share with.',
    features: ['Everything in Growth', 'Shopper journeys in detail', 'Export Insights for your team', 'Twice the page-level history', '250,000 tracked visits / month'],
  },
] as const;

export function MkPricing({ heading = true }: { heading?: boolean }) {
  return (
    <section id="pricing" className="scroll-mt-24 bg-[#fbfbfd] py-24 sm:py-32" data-tour-stop="pricing">
      <Container>
        {heading && (
          <Reveal className="mx-auto max-w-[760px] text-center">
            <Eyebrow>Pricing</Eyebrow>
            <H2>Pay for conversations. Nothing else.</H2>
            <Lead className="mx-auto mt-5 max-w-[560px]">One conversation is one shopper&apos;s visit with Olivia — voice or chat, same price. Change or cancel any time.</Lead>
          </Reveal>
        )}
        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {TIERS.map((t, i) => {
            const plan = PLAN_CREDITS[t.key]!;
            const per = (plan.price / plan.credits).toFixed(2);
            const popular = 'popular' in t && t.popular;
            return (
              <Reveal key={t.key} delay={i * 80}>
                <div
                  className={cn(
                    'relative flex h-full flex-col rounded-[26px] border bg-white p-7',
                    popular ? 'border-[var(--mk-accent)] shadow-[0_30px_70px_-30px_rgba(91,61,245,0.45)]' : 'border-[#ececf2]',
                  )}
                >
                  {popular && (
                    <span className="absolute -top-3 left-7 rounded-full bg-[var(--mk-accent)] px-3 py-1 text-[12px] font-semibold text-white">Most popular</span>
                  )}
                  <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0b0b10]">{t.name}</h3>
                  <p className="mt-1 text-[14.5px] text-[#6e6e7a]">{t.who}</p>
                  <p className="mt-5 flex items-baseline gap-1.5">
                    <span className="mk-h2 text-[56px] text-[#0b0b10]">${plan.price}</span>
                    <span className="text-[15px] text-[#6e6e7a]">/ month</span>
                  </p>
                  <div className="mt-4 rounded-2xl bg-[#f5f5f7] px-4 py-3">
                    <p className="text-[15px] font-semibold text-[#0b0b10]">{plan.credits.toLocaleString('en-US')} conversations a month</p>
                    <p className="text-[13px] text-[#6e6e7a]">≈ ${per} each · extra packs any time</p>
                  </div>
                  {popular ? (
                    <AccentButton href="/signup" size="md" className="mt-6 w-full">
                      Start with {t.name}
                    </AccentButton>
                  ) : (
                    <InkButton href="/signup" className="mt-6 h-11 w-full text-[15px]">
                      Start with {t.name}
                    </InkButton>
                  )}
                  <ul className="mt-6 flex flex-col gap-3 border-t border-[#f0f0f4] pt-6">
                    {t.features.map((f) => (
                      <li key={f} className="flex gap-2.5 text-[14.5px] leading-snug text-[#0b0b10]">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mk-accent)]" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-8 text-center text-[14px] text-[#6e6e7a]">
          Cancel anytime · Secure payments by Razorpay · Extra conversations $0.30 each · Bigger store?{' '}
          <a href="mailto:hello@shoppingmate.shop" className="font-medium text-[#0b0b10] underline underline-offset-2">
            hello@shoppingmate.shop
          </a>
        </p>
      </Container>
    </section>
  );
}

export function MkFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-24 py-24 sm:py-32">
      <Container className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Reveal>
          <Eyebrow>Questions</Eyebrow>
          <H2 className="text-[clamp(34px,4vw,52px)]">Everything owners ask before they start.</H2>
          <p className="mt-5 text-[16px] text-[#4a4a55]">
            Something else? Write to{' '}
            <a href="mailto:hello@shoppingmate.shop" className="font-medium text-[#0b0b10] underline underline-offset-2">
              hello@shoppingmate.shop
            </a>{' '}
            — or just ask Olivia.
          </p>
        </Reveal>
        <div className="divide-y divide-[#ececf2] border-y border-[#ececf2]">
          {FAQ_ITEMS.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={it.q}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-5 text-left text-[17px] font-medium text-[#0b0b10]"
                >
                  {it.q}
                  <Plus className={cn('h-5 w-5 shrink-0 text-[#6e6e7a] transition-transform duration-300', isOpen && 'rotate-45')} />
                </button>
                <div className={cn('grid transition-[grid-template-rows] duration-300', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <p className="overflow-hidden pb-0 text-[15.5px] leading-[1.6] text-[#4a4a55]" style={{ paddingBottom: isOpen ? 20 : 0 }}>
                    {it.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

export function MkFinalCta() {
  return (
    <section className="relative overflow-hidden py-28 sm:py-36">
      <div
        aria-hidden
        className="mk-halftone pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-[420px] max-w-[1100px] opacity-[0.2]"
        style={{ maskImage: 'radial-gradient(ellipse 50% 60% at 50% 100%, #000 30%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse 50% 60% at 50% 100%, #000 30%, transparent 75%)' }}
      />
      <Container className="relative text-center">
        <h2 className="mk-h1 mx-auto max-w-[900px] text-[clamp(42px,7vw,88px)] text-[#0b0b10]">
          Give every shopper a <span className="text-[var(--mk-accent)]">salesperson.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-[520px] text-[19px] text-[#4a4a55]">Paste one line today. Olivia is selling on your store in minutes.</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <AccentButton href="/signup">Put Olivia on my store</AccentButton>
          <TalkButton label="Talk to her first" />
        </div>
      </Container>
    </section>
  );
}

export function MkFooter() {
  const cols = [
    { h: 'Product', l: [['How it works', '/#how'], ['What she does', '/#what'], ['Pricing', '/pricing'], ['Platforms', '/platforms'], ['Install', '/install']] },
    { h: 'Company', l: [['FAQ', '/faq'], ['Privacy', '/legal/privacy'], ['Log in', '/login'], ['Get started', '/signup']] },
  ];
  return (
    <footer className="border-t border-[#f0f0f4] py-14">
      <Container className="flex flex-col gap-10 sm:flex-row sm:justify-between">
        <div className="max-w-[320px]">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shoppingmate-icon.png" alt="" className="h-7 w-7 rounded-lg object-cover" />
            <span className="text-[16px] font-semibold tracking-[-0.02em] text-[#0b0b10]">shoppingmate</span>
          </Link>
          <p className="mt-4 text-[14.5px] leading-relaxed text-[#6e6e7a]">Olivia sells on your store by voice and chat — on Shopify, WooCommerce or any website.</p>
          <a href="mailto:hello@shoppingmate.shop" className="mt-3 inline-block text-[14.5px] font-medium text-[#0b0b10]">
            hello@shoppingmate.shop
          </a>
        </div>
        <div className="flex gap-16">
          {cols.map((c) => (
            <div key={c.h}>
              <p className="text-[13px] font-medium text-[#0b0b10]">{c.h}</p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {c.l.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href!} className="text-[14.5px] text-[#6e6e7a] hover:text-[#0b0b10]">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
      <Container className="mt-12">
        <p className="text-[13px] text-[#9a9aa5]">© {new Date().getFullYear()} shoppingmate.shop</p>
      </Container>
    </footer>
  );
}
