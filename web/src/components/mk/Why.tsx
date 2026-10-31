'use client';
import { MessageCircleQuestion } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Container, Eyebrow, H2, Lead, Reveal } from './ui';

const PLATFORMS = ['Shopify', 'WooCommerce', 'BigCommerce', 'Wix', 'Squarespace', 'Magento', 'Custom websites'];

export function MkPlatforms() {
  const row = [...PLATFORMS, ...PLATFORMS];
  return (
    <section aria-label="Works with" className="border-y border-[#f0f0f4] py-10">
      <p className="mb-6 text-center text-[14px] font-medium text-[#6e6e7a]">Works on the store you already have</p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <ul className="mk-marquee flex w-max gap-14 pr-14">
          {row.map((p, i) => (
            <li key={i} className="whitespace-nowrap text-[clamp(22px,2.6vw,32px)] font-semibold tracking-[-0.03em] text-[#c4c4cf]" aria-hidden={i >= PLATFORMS.length}>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const QUESTIONS = [
  { q: 'Will this fit me?', a: 'Asks your size and height, then picks the right one.' },
  { q: 'When will it arrive?', a: 'Answers from your shipping policy, for their pincode or zip.' },
  { q: 'Which one is right for me?', a: 'Compares two products in plain words, then recommends.' },
  { q: 'Is there a discount?', a: 'Applies your live code at checkout — never invents one.' },
];

function VisitorGrid() {
  // 100 visitors on a typical store: ~2 buy.
  return (
    <div className="grid grid-cols-10 gap-1.5 sm:gap-2" role="img" aria-label="Out of 100 visitors, about 2 buy">
      {Array.from({ length: 100 }).map((_, i) => (
        <span
          key={i}
          className={cn('aspect-square rounded-full', i === 23 || i === 67 ? 'bg-[var(--mk-accent)]' : 'bg-[#e6e6ee]')}
        />
      ))}
    </div>
  );
}

export function MkWhy() {
  return (
    <section className="py-24 sm:py-32">
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <Reveal>
            <Eyebrow>Why stores need her</Eyebrow>
            <H2>Your store is losing sales in silence.</H2>
            <Lead className="mt-6 max-w-[520px]">
              Out of every 100 people who visit a typical online store, about 2 buy. The rest leave — often with a simple
              question nobody was there to answer.
            </Lead>
            <div className="mt-10 grid grid-cols-2 gap-6 border-t border-[#ececf2] pt-8">
              <div>
                <p className="mk-h2 text-[52px] text-[#0b0b10]">~2%</p>
                <p className="mt-1 text-[14px] leading-snug text-[#6e6e7a]">of visitors buy on a typical online store</p>
              </div>
              <div>
                <p className="mk-h2 text-[52px] text-[#0b0b10]">70%</p>
                <p className="mt-1 text-[14px] leading-snug text-[#6e6e7a]">
                  of shopping carts are abandoned{' '}
                  <a className="underline decoration-[#cfcfd8] underline-offset-2 hover:text-[#0b0b10]" href="https://baymard.com/lists/cart-abandonment-rate" target="_blank" rel="noopener">
                    (Baymard Institute)
                  </a>
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-[28px] border border-[#ececf2] bg-[#fbfbfd] p-6 sm:p-8">
              <VisitorGrid />
              <p className="mt-5 text-center text-[13px] text-[#6e6e7a]">100 visitors · <span className="font-medium text-[var(--mk-accent)]">2 buy</span> · 98 leave</p>
            </div>
          </Reveal>
        </div>

        <Reveal className="mt-24">
          <div className="text-center">
            <H2 className="mx-auto max-w-[820px]">The questions that cost you the sale — answered on the spot.</H2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUESTIONS.map((x, i) => (
              <Reveal key={x.q} delay={i * 80}>
                <div className="h-full rounded-[22px] border border-[#ececf2] bg-white p-5 shadow-[0_1px_2px_rgba(11,11,16,0.04)]">
                  <p className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-[#f2f2f6] px-3.5 py-2 text-[15px] font-medium text-[#0b0b10]">
                    <MessageCircleQuestion className="h-4 w-4 text-[#6e6e7a]" aria-hidden /> {x.q}
                  </p>
                  <p className="mt-4 text-[15px] leading-[1.5] text-[#4a4a55]">
                    <span className="font-semibold text-[var(--mk-accent)]">Olivia: </span>
                    {x.a}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
