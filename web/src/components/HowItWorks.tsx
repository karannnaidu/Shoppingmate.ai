"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Code2, Radar, Sparkles } from "lucide-react";
import { useRef } from "react";

const steps = [
  {
    n: "01",
    icon: Code2,
    title: "Paste one script tag",
    body: "Drop a single line into your <head>. No SDK, no OAuth, no platform integration. Works on every supported storefront the same way.",
    code: `<script async\n  src="https://cdn.shoppingmate.ai/v1.js"\n  data-id="SM-XXXX"></script>`,
  },
  {
    n: "02",
    icon: Radar,
    title: "We auto-onboard your store",
    body: "We fingerprint your platform, sync your catalog, and extract cart, checkout and coupon selectors. From paste to live in 5–8 minutes.",
    code: `→ shopify · catalog 482 SKUs\n→ selectors locked\n→ smoke test passed\n→ status: live`,
  },
  {
    n: "03",
    icon: Sparkles,
    title: "Your agent goes live",
    body: "A voice + text agent talks to visitors, picks variants, applies coupons, and hands off to your native checkout. You never touch a card.",
    code: `agent.cart.add(sku, qty)\nagent.coupons.try("WINTER15")\nagent.checkout.handoff()`,
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 80%", "end 30%"],
  });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section id="how" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHead
          eyebrow="How it works"
          title="From paste to live in three steps."
          subtitle="No engineering team required. No platform-specific apps to maintain."
        />

        <div ref={ref} className="relative mt-16 grid gap-8">
          {/* Vertical progress line (desktop) */}
          <div className="pointer-events-none absolute left-[42px] top-2 bottom-2 hidden w-px bg-border md:block">
            <motion.div
              style={{ height: lineHeight }}
              className="absolute left-0 top-0 w-px bg-gradient-to-b from-violet via-fuchsia to-cyan"
            />
          </div>

          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              className="grid grid-cols-1 gap-5 md:grid-cols-[88px_1fr_1fr] md:items-center md:gap-10"
            >
              <div className="hidden md:flex h-22 w-22 items-center justify-center">
                <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-border bg-surface-elevated text-text-secondary shadow-[var(--shadow-sm)]">
                  <s.icon className="h-5 w-5" />
                  <span className="absolute -bottom-2 -right-2 grid h-7 w-7 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background tabular-nums">
                    {s.n}
                  </span>
                </div>
              </div>

              <div>
                <span className="md:hidden font-mono text-xs uppercase tracking-wider text-text-muted">
                  Step {s.n}
                </span>
                <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight md:text-3xl">
                  {s.title}
                </h3>
                <p className="mt-3 max-w-md text-text-secondary text-pretty">
                  {s.body}
                </p>
              </div>

              <div className="relative">
                <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-violet/10 to-cyan/10 blur-xl opacity-70" aria-hidden />
                <div className="relative rounded-2xl border border-border bg-foreground/95 dark:bg-surface-elevated p-4 font-mono text-[12.5px] leading-relaxed text-background dark:text-text-primary shadow-[var(--shadow-md)]">
                  <div className="mb-2.5 flex items-center justify-between text-[10px] uppercase tracking-wider opacity-60">
                    <span>example</span>
                    <span className="flex gap-1">
                      <i className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
                      <i className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
                      <i className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap break-words">{s.code}</pre>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  return (
    <div
      className={`flex flex-col ${
        align === "center" ? "items-center text-center" : "items-start text-left"
      } gap-3`}
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
        <span className="h-1 w-1 rounded-full bg-violet" />
        {eyebrow}
      </span>
      <h2 className="max-w-3xl font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="max-w-2xl text-text-secondary md:text-lg text-pretty">
          {subtitle}
        </p>
      )}
    </div>
  );
}
