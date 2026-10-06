"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Mic,
  ShieldCheck,
  BookOpenText,
  Inbox,
  Map,
  ChartLine,
  CheckCheck,
} from "lucide-react";
import { SectionHead } from "./HowItWorks";

type Feature = {
  icon: typeof Mic;
  title: string;
  body: string;
  accent: "violet" | "cyan" | "fuchsia";
  tourId: string;
  wide?: boolean;
  badge?: string;
};

const features: Feature[] = [
  {
    icon: CheckCheck,
    title: "Does it, then shows you it's done",
    body:
      "Adds to cart, applies the best code, opens checkout and fills in the shopper's details — and every step appears with a tick only once the page confirms it. If something doesn't go through, it says so and fixes it. No pretending.",
    accent: "violet",
    tourId: "receipts",
    wide: true,
  },
  {
    icon: Mic,
    title: "Talks like your best salesperson",
    body:
      "Shoppers speak or type, in their own words. Natural, live voice with eight personalities — pick the tone that fits your brand.",
    accent: "cyan",
    tourId: "personas",
  },
  {
    icon: BookOpenText,
    title: "Knows your store inside out",
    body:
      "Learns your products, prices, FAQs, shipping and returns. Answers come from your own pages and documents — never made up.",
    accent: "fuchsia",
    tourId: "brand-kb",
  },
  {
    icon: Inbox,
    title: "Never misses a customer request",
    body:
      "Late order, damaged parcel, a callback, a bad review in the making — it takes their name and number and sends it straight to your team's inbox.",
    accent: "violet",
    tourId: "requests",
  },
  {
    icon: Map,
    title: "Learns your site once",
    body:
      "Maps every page type the first time, so answers stay instant. Redesigned your store? It notices and re-learns — or press one button to refresh.",
    accent: "cyan",
    tourId: "site-map",
  },
  {
    icon: ChartLine,
    title: "Store Insights, in plain English",
    body:
      "Where shoppers tap, where they get stuck, and why they leave — with a short weekly list of fixes. No charts to decode.",
    accent: "fuchsia",
    tourId: "insights",
    wide: true,
    badge: "Growth plan",
  },
  {
    icon: ShieldCheck,
    title: "Your checkout, untouched",
    body:
      "We never see card details. Shoppers always pay on your own secure checkout, and conversations auto-delete after 24 hours.",
    accent: "violet",
    tourId: "pci",
  },
];

const accentMap = {
  violet: "from-violet/20 to-violet/0 text-violet",
  cyan: "from-cyan/20 to-cyan/0 text-cyan",
  fuchsia: "from-fuchsia/20 to-fuchsia/0 text-fuchsia",
};

// The receipts a shopper sees in the chat as each step really completes.
const RECEIPTS = [
  { text: "Added Sleep Mantra to your cart", ok: true },
  { text: "Applied code WELCOME10", ok: true },
  { text: "Opened checkout", ok: true },
  { text: "Filled in your details — please check them", ok: true },
];

function ReceiptDemo() {
  const reduce = useReducedMotion();
  return (
    <div
      className="mt-6 flex flex-col items-start gap-2 self-center rounded-xl md:mt-0 border border-border bg-surface p-4"
      aria-label="Example of what a shopper sees as each step completes"
    >
      <div className="mb-1 max-w-[85%] rounded-2xl rounded-bl-md bg-surface-muted px-3.5 py-2 text-[13px] text-text-primary">
        Done — it&apos;s all on your screen. Give it a quick check and tap Place Order.
      </div>
      {RECEIPTS.map((r, i) => (
        <motion.div
          key={r.text}
          initial={reduce ? false : { opacity: 0, x: -8, scale: 0.97 }}
          whileInView={{ opacity: 1, x: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.38, delay: reduce ? 0 : 0.25 + i * 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 py-1 pl-1.5 pr-3 text-[12px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300"
        >
          <motion.span
            aria-hidden
            initial={reduce ? false : { scale: 0.2, rotate: -25 }}
            whileInView={{ scale: 1, rotate: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ type: "spring", stiffness: 520, damping: 16, delay: reduce ? 0 : 0.35 + i * 0.42 }}
            className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-white"
          >
            ✓
          </motion.span>
          {r.text}
        </motion.div>
      ))}
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="relative py-24 md:py-32" aria-label="Features" data-tour-stop="features">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHead
          eyebrow="What it does"
          title="Built like a sales floor — runs like a system."
          subtitle="Not a chatbot. Not a coupon banner. It talks to shoppers, works your real storefront, and shows its work."
        />

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              aria-label={`${f.title} card`}
              data-tour-stop={f.tourId}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.04 }}
              className={`group relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-6 transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-md)] motion-reduce:hover:translate-y-0 ${
                f.wide ? "md:col-span-2" : ""
              }`}
            >
              <span
                className={`absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60 ${accentMap[f.accent]}`}
                aria-hidden
              />
              <div className={`relative ${f.tourId === "receipts" ? "md:grid md:grid-cols-[1fr_1.1fr] md:gap-8" : ""}`}>
                <div>
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface text-text-secondary transition-colors group-hover:border-border-strong group-hover:text-text-primary">
                      <f.icon className="h-5 w-5" />
                    </div>
                    {f.badge && (
                      <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">
                        {f.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-text-secondary">{f.body}</p>
                </div>
                {f.tourId === "receipts" && <ReceiptDemo />}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
