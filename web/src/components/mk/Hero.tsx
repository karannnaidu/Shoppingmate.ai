'use client';
import { useEffect, useState } from 'react';
import { Check, ShoppingBag, Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AccentButton, Container, ExampleTag, OLIVIA_AVATAR, TalkButton } from './ui';

type Line = { who: 'shopper' | 'olivia'; text: string };
const SCRIPT: Line[] = [
  { who: 'shopper', text: 'Is this okay for dry, sensitive skin?' },
  { who: 'olivia', text: "Yes — it's fragrance-free and made for dry skin. Most people start with the 50 ml." },
  { who: 'shopper', text: 'Great, add it. Any discount?' },
  { who: 'olivia', text: 'Added — and WELCOME10 took 10% off. Taking you to checkout.' },
];
const STEPS = ['Added to cart', 'WELCOME10 applied', 'Checkout ready'];

// The scripted call: one line every ~1.6s, then the actions tick, then a pause
// and loop. Reduced motion shows the finished state.
function useScript() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(SCRIPT.length + STEPS.length + 1);
      return;
    }
    const total = SCRIPT.length + STEPS.length + 1;
    const t = setInterval(() => setStep((s) => (s >= total + 2 ? 0 : s + 1)), 1600);
    return () => clearInterval(t);
  }, []);
  return step;
}

function Bottle() {
  return (
    <div className="relative mx-auto h-[210px] w-[120px]" aria-hidden>
      <div className="absolute left-1/2 top-0 h-7 w-12 -translate-x-1/2 rounded-t-md bg-[#1f1f27]" />
      <div className="absolute left-1/2 top-6 h-4 w-16 -translate-x-1/2 rounded-sm bg-[#2c2c36]" />
      <div className="absolute inset-x-0 bottom-0 top-9 rounded-[28px] bg-gradient-to-b from-[#f4efe6] to-[#e7dccb] shadow-[inset_0_-12px_24px_rgba(0,0,0,0.06),0_20px_40px_-18px_rgba(60,40,20,0.45)]">
        <div className="absolute inset-x-4 top-12 rounded-md bg-white/80 px-2 py-3 text-center">
          <p className="text-[9px] font-semibold tracking-[0.18em] text-[#3a2f22]">LUMEN</p>
          <p className="mt-1 text-[8px] text-[#6b5c48]">Barrier Repair Cream</p>
          <p className="mt-0.5 text-[7px] text-[#9a8a74]">50 ml</p>
        </div>
      </div>
    </div>
  );
}

function StoreMock({ step }: { step: number }) {
  const inCart = step >= SCRIPT.length + 1 ? 1 : 0;
  return (
    <div className="overflow-hidden rounded-[22px] border border-[#ececf2] bg-white shadow-[0_40px_90px_-30px_rgba(11,11,16,0.35)]">
      <div className="flex items-center gap-2 border-b border-[#f0f0f4] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 hidden flex-1 truncate rounded-md bg-[#f5f5f7] px-3 py-1 text-[12px] text-[#6e6e7a] sm:block">
          lumenskin.com/products/barrier-repair-cream
        </span>
        <span className="relative ml-auto inline-flex items-center gap-1 rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[12px] font-medium text-[#0b0b10]">
          <ShoppingBag className="h-3.5 w-3.5" /> Cart
          <span
            className={cn(
              'grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold transition-all duration-500',
              inCart ? 'scale-100 bg-[var(--mk-accent)] text-white' : 'scale-90 bg-[#e3e3ea] text-[#6e6e7a]',
            )}
          >
            {inCart}
          </span>
        </span>
      </div>
      <div className="grid gap-6 p-5 sm:grid-cols-[1fr_1.1fr] sm:p-7">
        <div className="grid place-items-center rounded-2xl bg-[#faf7f2] py-6">
          <Bottle />
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-[12px] font-semibold tracking-[0.14em] text-[#9a8a74]">LUMEN SKIN</p>
          <p className="mt-1.5 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[#0b0b10]">Barrier Repair Cream</p>
          <div className="mt-2 flex items-center gap-1 text-[13px] text-[#4a4a55]">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="h-3.5 w-3.5 fill-[#f5a524] text-[#f5a524]" />
            ))}
            <span className="ml-1">4.8 · 2,140 reviews</span>
          </div>
          <p className="mt-3 text-[20px] font-semibold text-[#0b0b10]">$48.00</p>
          <div className="mt-4 flex gap-2">
            {['30 ml', '50 ml', '100 ml'].map((s) => (
              <span
                key={s}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-[13px]',
                  s === '50 ml' ? 'border-[#0b0b10] font-medium text-[#0b0b10]' : 'border-[#e8e8ee] text-[#6e6e7a]',
                )}
              >
                {s}
              </span>
            ))}
          </div>
          <div className="mt-5 h-11 rounded-xl bg-[#0b0b10] text-center text-[14px] font-medium leading-[44px] text-white">Add to cart</div>
        </div>
      </div>
    </div>
  );
}

// Phones: the product the shopper is looking at, docked on top of the call.
function MiniProduct({ step }: { step: number }) {
  const inCart = step >= SCRIPT.length + 1 ? 1 : 0;
  return (
    <div className="relative z-10 -mb-5 flex w-[92%] items-center gap-3 rounded-2xl border border-[#ececf2] bg-white p-3 shadow-[0_18px_40px_-18px_rgba(11,11,16,0.35)]">
      <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-[#faf7f2]">
        <div className="absolute left-1/2 top-1 origin-top -translate-x-1/2 scale-[0.32]">
          <Bottle />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[#9a8a74]">LUMEN SKIN</p>
        <p className="truncate text-[14.5px] font-semibold text-[#0b0b10]">Barrier Repair Cream</p>
        <p className="text-[13px] text-[#4a4a55]">$48.00 · 50 ml</p>
      </div>
      <span className="relative inline-flex items-center gap-1 rounded-full bg-[#f5f5f7] px-2.5 py-1.5 text-[12px] font-medium text-[#0b0b10]">
        <ShoppingBag className="h-3.5 w-3.5" />
        <span
          className={cn(
            'grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-semibold transition-all duration-500',
            inCart ? 'scale-110 bg-[var(--mk-accent)] text-white' : 'bg-[#e3e3ea] text-[#6e6e7a]',
          )}
        >
          {inCart}
        </span>
      </span>
    </div>
  );
}

function CallPanel({ step }: { step: number }) {
  const lines = SCRIPT.slice(0, Math.min(step, SCRIPT.length));
  const ticks = Math.max(0, Math.min(STEPS.length, step - SCRIPT.length));
  const placed = step > SCRIPT.length + STEPS.length;
  return (
    <div className="w-full max-w-[360px] rounded-[26px] bg-[#0b0b10] p-4 text-white shadow-[0_40px_90px_-24px_rgba(11,11,16,0.6)] ring-1 ring-white/10">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={OLIVIA_AVATAR} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-[#16a34a]" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Olivia</p>
          <p className="flex items-center gap-1.5 text-[12px] text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" style={{ animation: 'mk-pulse 1.4s ease-in-out infinite' }} />
            On a call · Lumen Skin
          </p>
        </div>
        <span className="flex items-end gap-[3px]" aria-hidden>
          {[10, 18, 12, 22, 14, 8].map((h, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-[#22c55e]"
              style={{ height: h, animation: `mk-pulse ${0.9 + i * 0.13}s ease-in-out infinite` }}
            />
          ))}
        </span>
      </div>
      <div className="mt-4 flex min-h-[198px] flex-col justify-end gap-2" aria-live="polite">
        {lines.map((l, i) => (
          <p
            key={i}
            className={cn(
              'max-w-[88%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug',
              l.who === 'shopper' ? 'self-end rounded-br-md bg-white text-[#0b0b10]' : 'self-start rounded-bl-md bg-white/10 text-white',
            )}
            style={{ animation: 'mk-rise 0.4s ease both' }}
          >
            {l.text}
          </p>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium transition-all duration-500',
              i < ticks ? 'bg-[#16a34a]/20 text-[#4ade80]' : 'bg-white/5 text-white/30',
            )}
          >
            <Check className="h-3 w-3" /> {s}
          </span>
        ))}
      </div>
      <div
        className={cn(
          'mt-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-[#0b0b10] transition-all duration-500',
          placed ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        )}
      >
        <span className="text-[13px] font-medium">Order placed</span>
        <span className="text-[15px] font-semibold">$43.20</span>
      </div>
    </div>
  );
}

export function MkHero() {
  const step = useScript();
  return (
    <section className="relative overflow-hidden pb-14 pt-28 sm:pb-24 sm:pt-40">
      <div
        aria-hidden
        className="mk-halftone pointer-events-none absolute left-1/2 top-0 h-[520px] w-[1100px] -translate-x-1/2 opacity-[0.22]"
        style={{ maskImage: 'radial-gradient(ellipse 50% 60% at 50% 0%, #000 30%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse 50% 60% at 50% 0%, #000 30%, transparent 75%)' }}
      />
      <Container className="relative text-center">
        <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[#e8e8ee] bg-white px-3 py-1.5 text-[13px] font-medium text-[#4a4a55]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
          Live now — tap the call button and talk to her
        </p>
        <h1 className="mk-h1 mx-auto max-w-[980px] text-[clamp(46px,8.4vw,108px)] text-[#0b0b10]">
          Every shopper gets a <span className="text-[var(--mk-accent)]">salesperson.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-[640px] text-[clamp(17px,1.8vw,21px)] leading-[1.5] text-[#4a4a55]">
          Olivia answers questions, recommends the right product and walks shoppers to checkout — by voice or chat, on
          your Shopify, WooCommerce or any website.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <AccentButton href="/signup">Put Olivia on my store</AccentButton>
          <TalkButton />
        </div>
        <p className="mt-5 text-[14px] text-[#6e6e7a]">Live in 60 seconds · No app or plugin · From $30/month</p>
      </Container>

      <Container className="relative mt-12 sm:mt-20">
        <div className="relative mx-auto max-w-[1060px]">
          <div className="hidden lg:block lg:pr-[220px]">
            <StoreMock step={step} />
          </div>
          <div className="hidden lg:absolute lg:-bottom-10 lg:right-0 lg:block">
            <CallPanel step={step} />
          </div>
          {/* Phones: same live demo, sized for the screen, gently floating. */}
          <div className="mx-auto flex max-w-[380px] flex-col items-center lg:hidden" style={{ animation: 'mk-float 6s ease-in-out infinite' }}>
            <MiniProduct step={step} />
            <CallPanel step={step} />
          </div>
        </div>
        <div className="mt-6 flex justify-center lg:mt-14">
          <ExampleTag className="text-[12px]" />
          <span className="ml-2 text-[12px] text-[#6e6e7a]">An example conversation on a demo store.</span>
        </div>
      </Container>
    </section>
  );
}
