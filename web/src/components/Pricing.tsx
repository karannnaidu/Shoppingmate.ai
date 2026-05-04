"use client";

import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { SectionHead } from "./HowItWorks";

type Tier = {
  name: string;
  tag: string;
  price: string;
  suffix?: string;
  desc: string;
  features: string[];
  highlight?: boolean;
  cta: string;
  href: string;
};

const tiers: Tier[] = [
  {
    name: "Starter",
    tag: "Solo merchants",
    price: "$30",
    suffix: "/ month",
    desc: "Voice + text shopping live on your store, 1 persona, brand KB up to 1MB. Unmetered conversations.",
    features: [
      "1 persona",
      "Brand KB ≤ 1MB",
      "Conversion attribution",
      "Permanent override locks",
      "Email support",
    ],
    cta: "Get started",
    href: "/signup",
  },
  {
    name: "Growth",
    tag: "Closed-beta favorite",
    price: "$60",
    suffix: "/ month",
    desc: "Everything in Starter, plus all 8 personas, coupon discovery, and multi-storefront.",
    features: [
      "All 8 personas",
      "Coupon auto-stack",
      "Brand KB unlimited",
      "Multi-store ($/store)",
      "Slack support, 4h SLA",
    ],
    highlight: true,
    cta: "Get started",
    href: "/signup",
  },
  {
    name: "Enterprise",
    tag: "Brands at scale",
    price: "Custom",
    desc: "Dedicated infra, custom personas, audit logs, SSO, SOC 2 docs, named CSM.",
    features: [
      "Custom personas",
      "SSO + audit logs",
      "Dedicated infra",
      "SOC 2 + DPA",
      "Named CSM, 1h SLA",
    ],
    cta: "Talk to sales",
    href: "mailto:hello@shoppingmate.ai?subject=Enterprise",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative py-24 md:py-32">
      <div className="absolute inset-x-0 top-0 -z-10 mx-auto h-96 max-w-3xl bg-gradient-to-b from-violet/10 to-transparent blur-3xl" aria-hidden />
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHead
          eyebrow="Pricing"
          title="Flat monthly. No per-seat tax."
          subtitle="Unmetered conversations on every plan. Cancel anytime, no card surprises."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {tiers.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className={`relative flex flex-col rounded-3xl border p-7 transition-all ${
                t.highlight
                  ? "border-transparent bg-foreground text-background shadow-[var(--shadow-lg)]"
                  : "border-border bg-surface-elevated hover:border-border-strong"
              }`}
            >
              {t.highlight && (
                <div className="absolute -inset-px -z-10 rounded-3xl bg-gradient-to-br from-violet via-fuchsia to-cyan opacity-90 blur-md" aria-hidden />
              )}
              {t.highlight && (
                <span className="absolute -top-3 right-6 inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground border border-border">
                  <Sparkles className="h-3 w-3 text-violet" />
                  Most popular
                </span>
              )}

              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  {t.name}
                </h3>
                <span className={`text-xs ${t.highlight ? "text-background/70" : "text-text-muted"}`}>
                  {t.tag}
                </span>
              </div>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-5xl font-semibold tracking-tight tabular-nums">
                  {t.price}
                </span>
                {t.suffix && (
                  <span className={`text-sm ${t.highlight ? "text-background/70" : "text-text-muted"}`}>
                    {t.suffix}
                  </span>
                )}
              </div>

              <p
                className={`mt-3 text-sm ${
                  t.highlight ? "text-background/80" : "text-text-secondary"
                }`}
              >
                {t.desc}
              </p>

              <ul className="mt-6 grid gap-2.5">
                {t.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-center gap-2.5 text-sm ${
                      t.highlight ? "text-background/90" : "text-text-secondary"
                    }`}
                  >
                    <span
                      className={`grid h-4 w-4 place-items-center rounded-full ${
                        t.highlight ? "bg-background/15" : "bg-violet/15"
                      }`}
                    >
                      <Check
                        className={`h-2.5 w-2.5 ${
                          t.highlight ? "text-background" : "text-violet"
                        }`}
                      />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={t.href}
                className={`mt-8 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition-transform hover:scale-[1.02] active:scale-[0.98] ${
                  t.highlight
                    ? "bg-background text-foreground"
                    : "border border-border bg-surface text-text-primary hover:border-border-strong"
                }`}
              >
                {t.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-xs text-text-muted">
          All plans include conversion attribution. No card data ever stored — payment
          always redirects to your native checkout.
        </p>
      </div>
    </section>
  );
}
