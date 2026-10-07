"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, MessageCircle, Mic, Plus } from "lucide-react";
import Link from "next/link";
import { SectionHead, SerifEm } from "./v2/primitives";

// Source of truth: web/src/app/app/billing/page.tsx (PLAN_CREDITS, TOPUPS) and
// packages/db/src/plans.ts (Store Insights on growth/scale). Keep in sync.
type Tier = {
  key: "starter" | "growth" | "scale";
  name: string;
  tag: string;
  price: number;
  conversations: string;
  perConvo: string;
  desc: string;
  features: string[];
  highlight?: boolean;
};

const tiers: Tier[] = [
  {
    key: "starter",
    name: "Starter",
    tag: "Getting going",
    price: 30,
    conversations: "100",
    perConvo: "$0.30",
    desc: "Everything Olivia does, for a store finding its feet.",
    features: [
      "Voice + chat on every page",
      "Cart, best-code and checkout help",
      "Customer requests sent to your inbox",
      "Dashboard with every conversation",
      "Trained on your products and policies",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    tag: "Most popular",
    price: 99,
    conversations: "350",
    perConvo: "$0.28",
    desc: "For stores that want to know why shoppers leave — and fix it.",
    features: [
      "Everything in Starter",
      "Store Insights: where shoppers get stuck",
      "Weekly list of fixes, in plain English",
      "Heatmaps by page type",
      "Weekly Insights email · 50,000 tracked visits/mo",
    ],
    highlight: true,
  },
  {
    key: "scale",
    name: "Scale",
    tag: "High traffic",
    price: 299,
    conversations: "1,000",
    perConvo: "$0.30",
    desc: "More conversations, deeper Insights and exports for your team.",
    features: [
      "Everything in Growth",
      "Shopper journeys in detail",
      "Export Insights for your team",
      "Twice the page-level history",
      "250,000 tracked visits / month",
    ],
  },
];

export function Pricing({ hideHeading = false }: { hideHeading?: boolean }) {
  return (
    <section
      id="pricing"
      className={`relative ${hideHeading ? "pb-24 pt-4 md:pb-32" : "py-24 md:py-32"}`}
      aria-label="Plan grid"
      data-tour-stop="pricing"
    >
      <div className="absolute inset-x-0 top-0 -z-10 mx-auto h-96 max-w-3xl bg-gradient-to-b from-violet/10 to-transparent blur-3xl" aria-hidden />
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        {!hideHeading && <SectionHead
          eyebrow="Pricing"
          title={
            <>
              Pay for conversations, <SerifEm>not seats.</SerifEm>
            </>
          }
          subtitle="Every plan includes the full assistant — voice and chat. Plans differ by how many conversations you get each month and how deep your Insights go."
        />}

        <div className={`${hideHeading ? "mt-2" : "mt-14"} grid gap-5 lg:grid-cols-3`}>
          {tiers.map((t, i) => (
            <motion.div
              key={t.name}
              aria-label={`${t.name} plan card`}
              data-tour-stop={`${t.key}-plan-card`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.55, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              className={`relative flex flex-col rounded-[28px] p-7 ${
                t.highlight ? "bg-foreground text-background shadow-[var(--shadow-lg)]" : "card-v2 card-v2-hover"
              }`}
            >
              {t.highlight && (
                <div
                  className="absolute -inset-px -z-10 rounded-[28px] bg-gradient-to-br from-violet via-fuchsia/70 to-signal opacity-80 blur-md"
                  aria-hidden
                />
              )}

              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold tracking-tight">{t.name}</h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    t.highlight ? "bg-background/10 text-background/80" : "border border-border text-text-muted"
                  }`}
                >
                  {t.tag}
                </span>
              </div>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="font-display text-6xl font-semibold tracking-[-0.04em] tabular-nums">${t.price}</span>
                <span className={`text-sm ${t.highlight ? "text-background/65" : "text-text-muted"}`}>/ month</span>
              </div>

              <div
                className={`mt-4 flex items-center justify-between rounded-2xl px-4 py-3 ${
                  t.highlight ? "bg-background/[0.07]" : "bg-surface-muted"
                }`}
              >
                <span className="text-sm">
                  <strong className="font-semibold tabular-nums">{t.conversations}</strong> conversations / mo
                </span>
                <span className={`text-xs tabular-nums ${t.highlight ? "text-background/60" : "text-text-muted"}`}>
                  ≈ {t.perConvo} each
                </span>
              </div>

              <p className={`mt-4 text-sm ${t.highlight ? "text-background/75" : "text-text-secondary"}`}>{t.desc}</p>

              <ul className="mt-6 grid gap-2.5">
                {t.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2.5 text-sm ${t.highlight ? "text-background/90" : "text-text-secondary"}`}
                  >
                    <span
                      className={`mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-full ${
                        t.highlight ? "bg-signal text-black" : "bg-signal-soft text-signal"
                      }`}
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={t.key === "starter" ? "/signup" : `/signup?plan=${t.key}`}
                className={`group mt-8 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-transform hover:scale-[1.02] active:scale-[0.98] ${
                  t.highlight ? "bg-background text-foreground" : "border border-border bg-surface text-text-primary hover:border-border-strong"
                }`}
              >
                Start with {t.name}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          ))}
        </div>

        {/* What counts + top-ups + enterprise */}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="card-v2 p-5">
            <div className="flex items-center gap-2 text-text-secondary">
              <MessageCircle className="h-4 w-4" />
              <Mic className="h-4 w-4" />
            </div>
            <h4 className="mt-3 font-medium">What counts as a conversation?</h4>
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
              One shopper&apos;s visit with Olivia — however many messages, by voice or chat. Voice costs the same as text.
            </p>
          </div>
          <div className="card-v2 p-5">
            <div className="flex items-center gap-2 text-text-secondary">
              <Plus className="h-4 w-4" />
            </div>
            <h4 className="mt-3 font-medium">Busy month? Top up anytime</h4>
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
              Extra conversations are $0.30 each, in packs of 100, 500 or 1,000. Unused top-ups carry over.
            </p>
          </div>
          <div className="card-v2 p-5">
            <div className="flex items-center gap-2 text-text-secondary">
              <ArrowRight className="h-4 w-4" />
            </div>
            <h4 className="mt-3 font-medium">Several stores or big volume?</h4>
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
              We&apos;ll set up a plan that fits. Write to <span className="text-text-primary">hello@shoppingmate.ai</span>.
            </p>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-xs text-text-muted">
          Prices in USD. Cancel anytime from your dashboard. We never see card details — shoppers always pay on your own checkout.
        </p>
      </div>
    </section>
  );
}
