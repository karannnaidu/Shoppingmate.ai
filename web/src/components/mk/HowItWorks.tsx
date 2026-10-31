'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Container, Eyebrow, ExampleTag, H2, Panel } from './ui';

function CodePanel() {
  return (
    <Panel className="p-5">
      <p className="mb-3 text-[13px] font-medium text-[#6e6e7a]">Paste before &lt;/body&gt;</p>
      <pre className="overflow-x-auto rounded-xl bg-[#0b0b10] p-4 font-mono text-[13px] leading-relaxed text-[#e9e7ff]">
        <span className="text-[#9b8cff]">&lt;script</span> async{'\n'}  src=<span className="text-[#86efac]">&quot;https://www.shoppingmate.shop/widget/v1.js&quot;</span>
        {'\n'}  data-id=<span className="text-[#86efac]">&quot;SM-XXXXXX&quot;</span>
        <span className="text-[#9b8cff]">&gt;&lt;/script&gt;</span>
      </pre>
    </Panel>
  );
}

function ChecklistPanel({ items }: { items: string[] }) {
  return (
    <Panel className="p-5">
      <ul className="flex flex-col gap-3">
        {items.map((t) => (
          <li key={t} className="flex items-center gap-3 text-[15px] text-[#0b0b10]">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#16a34a]/12 text-[#16a34a]">
              <Check className="h-3.5 w-3.5" />
            </span>
            {t}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function SellPanel() {
  return (
    <Panel className="p-5">
      <div className="flex flex-col gap-2">
        <p className="self-end rounded-2xl rounded-br-md bg-[#0b0b10] px-3.5 py-2 text-[14px] text-white">Do you have this in a size 9?</p>
        <p className="self-start rounded-2xl rounded-bl-md bg-[#f2f2f6] px-3.5 py-2 text-[14px] text-[#0b0b10]">Yes — two left in 9. Shall I add it and take you to checkout?</p>
        <p className="self-end rounded-2xl rounded-br-md bg-[#0b0b10] px-3.5 py-2 text-[14px] text-white">Yes please.</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {['Added to cart', 'Checkout filled in'].map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-[#16a34a]/10 px-2.5 py-1 text-[12px] font-medium text-[#15803d]">
            <Check className="h-3 w-3" /> {s}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function DashboardPanel() {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-[#6e6e7a]">This week</p>
        <ExampleTag />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {[
          ['312', 'conversations'],
          ['41', 'orders helped'],
          ['$4,180', 'sold with Olivia'],
        ].map(([n, l]) => (
          <div key={l}>
            <p className="text-[24px] font-semibold tracking-[-0.03em] text-[#0b0b10]">{n}</p>
            <p className="text-[12px] text-[#6e6e7a]">{l}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-xl bg-[#fff7ed] p-3">
        <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-[#c2410c]" aria-hidden />
        <p className="text-[13.5px] leading-snug text-[#7c2d12]">
          <span className="font-semibold">New request:</span> order 10234 arrived damaged — photo attached, wants a replacement.
        </p>
      </div>
    </Panel>
  );
}

function InsightPanel() {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-[#6e6e7a]">Fix of the week</p>
        <ExampleTag />
      </div>
      <p className="mt-3 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-[#0b0b10]">
        38 shoppers asked about delivery times before leaving.
      </p>
      <p className="mt-2 text-[14.5px] leading-relaxed text-[#4a4a55]">Add &ldquo;Delivered in 3–5 days&rdquo; next to the price on product pages.</p>
    </Panel>
  );
}

const STEPS = [
  { tag: 'Install', title: 'Paste one line', body: 'Add a single line to your site — or ask whoever runs it. No app, no plugin, nothing to maintain.', panel: <CodePanel /> },
  {
    tag: 'Learn',
    title: 'She learns your store',
    body: 'Olivia reads your products, prices, shipping, returns and FAQs on her own. Usually ready in a few minutes.',
    panel: <ChecklistPanel items={['Found 482 products', 'Read shipping & returns', 'Learned your FAQs', 'Ready to talk']} />,
  },
  { tag: 'Sell', title: 'She sells, all day', body: 'Shoppers talk or type. Olivia answers, picks the right product, adds it to the cart and walks them to your checkout.', panel: <SellPanel /> },
  { tag: 'Report', title: 'You see everything', body: 'Every conversation, sale and customer request lands in your dashboard and inbox — in plain English.', panel: <DashboardPanel /> },
  { tag: 'Improve', title: 'Every week, a better store', body: 'She spots what shoppers keep asking and where they give up, and tells you the one fix worth making.', panel: <InsightPanel /> },
];

// Rounded-rect track; each step sits at a fraction of the perimeter.
const W = 440;
const H = 320;
const R = 70;
const TRACK = `M ${R} 10 H ${W - R} A ${R - 10} ${R - 10} 0 0 1 ${W - 10} ${R} V ${H - R} A ${R - 10} ${R - 10} 0 0 1 ${W - R} ${H - 10} H ${R} A ${R - 10} ${R - 10} 0 0 1 10 ${H - R} V ${R} A ${R - 10} ${R - 10} 0 0 1 ${R} 10 Z`;
const AT = [0.62, 0.84, 0.02, 0.22, 0.42];

function Loop({ active }: { active: number }) {
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);
  const [pos, setPos] = useState(AT[0]!);
  const target = useRef(AT[0]!);
  useEffect(() => {
    if (pathRef.current) setLen(pathRef.current.getTotalLength());
  }, []);
  useEffect(() => {
    target.current = AT[active] ?? 0;
    let raf = 0;
    const tick = () => {
      setPos((p) => {
        // travel forward around the loop to the target
        let d = target.current - p;
        if (d < 0) d += 1;
        if (d < 0.002) return target.current;
        return (p + Math.max(0.004, d * 0.08)) % 1;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  const pt = pathRef.current && len ? pathRef.current.getPointAtLength(pos * len) : { x: R, y: 10 };
  const start = AT[0]! * len;
  const traveled = ((pos - AT[0]! + 1) % 1) * len;
  const labelAt = (f: number) => (pathRef.current && len ? pathRef.current.getPointAtLength(f * len) : null);
  return (
    <div className="relative px-24 py-14">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label={`Step ${active + 1} of ${STEPS.length}: ${STEPS[active]?.tag}`}>
        <defs>
          <pattern id="mk-dots" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="3.5" cy="3.5" r="1.1" fill="#d4d4de" />
          </pattern>
        </defs>
        <path d={TRACK} fill="none" stroke="url(#mk-dots)" strokeWidth="26" />
        <path
          ref={pathRef}
          d={TRACK}
          fill="none"
          stroke="var(--mk-accent)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${traveled} ${len}`}
          strokeDashoffset={-start}
        />
        <circle cx={pt.x} cy={pt.y} r="22" fill="var(--mk-accent)" opacity="0.14" />
        <circle cx={pt.x} cy={pt.y} r="10" fill="var(--mk-accent)" />
        <circle cx={pt.x} cy={pt.y} r="4" fill="#fff" />
      </svg>
      {/* Step pills: HTML over the SVG so they never clip. */}
      <div className="pointer-events-none absolute inset-x-24 inset-y-14">
        {AT.map((f, i) => {
          const p = labelAt(f);
          if (!p) return null;
          const left = (p.x / W) * 100;
          const top = (p.y / H) * 100;
          const outside = p.x < W * 0.2 ? 'right' : p.x > W * 0.8 ? 'left' : p.y < H / 2 ? 'below' : 'above';
          const shift =
            outside === 'right' ? 'translate(calc(-100% - 22px), -50%)' : outside === 'left' ? 'translate(22px, -50%)' : outside === 'below' ? 'translate(-50%, calc(-100% - 22px))' : 'translate(-50%, 22px)';
          return (
            <span
              key={i}
              className={cn(
                'absolute whitespace-nowrap rounded-full border px-3 py-1 text-[13px] font-medium transition-colors duration-300',
                i === active ? 'border-[#0b0b10] bg-[#0b0b10] text-white' : 'border-[#e8e8ee] bg-white text-[#6e6e7a]',
              )}
              style={{ left: `${left}%`, top: `${top}%`, transform: shift }}
            >
              {STEPS[i]?.tag}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function MkHowItWorks() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <section id="how" className="scroll-mt-24 bg-[#fbfbfd] py-24 sm:py-32">
      <Container>
        <div className="max-w-[720px]">
          <Eyebrow>How it works</Eyebrow>
          <H2>Live on your store in a minute. Selling from the first visitor.</H2>
        </div>
        <div className="mt-16 grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-24 lg:gap-[30vh] lg:pb-[20vh]">
            {STEPS.map((s, i) => (
              <div
                key={s.tag}
                data-step={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={cn('transition-opacity duration-500', i === active ? 'lg:opacity-100' : 'lg:opacity-40')}
              >
                <p className="text-[14px] font-medium text-[var(--mk-accent)]">
                  {String(i + 1).padStart(2, '0')} · {s.tag}
                </p>
                <h3 className="mk-h2 mt-2 text-[clamp(28px,3.2vw,40px)] text-[#0b0b10]">{s.title}</h3>
                <p className="mt-3 max-w-[480px] text-[17px] leading-[1.55] text-[#4a4a55]">{s.body}</p>
                <div className="mt-6 min-w-0 max-w-[520px]">{s.panel}</div>
              </div>
            ))}
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-[22vh]">
              <Loop active={active} />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
