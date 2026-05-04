"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { SectionHead } from "./HowItWorks";

const items = [
  {
    q: "Does it work without a Shopify app or Woo plugin?",
    a: "Yes. The widget loads from a single <script> tag and runs entirely client-side in a Shadow DOM. We talk to your platform via its public storefront APIs — no app install, no plugin, no permissions to approve.",
  },
  {
    q: "What happens on a custom-built website?",
    a: "If we can't fingerprint a known platform, we fall back to DOM mode — the widget literally drives the visitor's browser: clicks the add-to-cart, applies the coupon, taps checkout. Visitor experience is identical.",
  },
  {
    q: "Will the AI hallucinate prices or product details?",
    a: "No. Cards display prices from your DB-trusted catalog. The voice never speaks a numeric price — it always paraphrases and defers to what's on screen. Brand KB content is quoted verbatim from your uploaded docs.",
  },
  {
    q: "How does coupon discovery work?",
    a: "We scrape your coupon page, watch observed codes from real visitors, and accept merchant-entered codes from your dashboard. coupons.suggest(cart) ranks the best applicable code per the live cart and either confirms with the visitor or auto-applies — your call.",
  },
  {
    q: "Where does payment data live?",
    a: "Nowhere on our servers. The widget never collects card data. When a visitor taps Pay, we redirect to your native checkout. We are out of PCI scope by design.",
  },
  {
    q: "Can I override what the widget does?",
    a: "Yes. Open the recipe-card editor, point at the broken element, save the override — it's locked permanently. Auto-recrawl and LLM healing skip every locked selector. If a locked override starts failing, we email you a one-click suggested fix.",
  },
  {
    q: "How long does install take?",
    a: "Under 60 seconds for the script paste. Auto-onboarding (platform fingerprint, catalog sync, selector extraction, smoke test) completes in 5–8 minutes. From paste to live shopping: under 10 minutes total, zero merchant action.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-4xl px-5 md:px-8">
        <SectionHead
          eyebrow="FAQ"
          title="The questions every merchant asks."
        />

        <div className="mt-14 grid gap-2.5">
          {items.map((it, i) => {
            const expanded = open === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.4, delay: i * 0.03 }}
                className={`overflow-hidden rounded-2xl border transition-colors ${
                  expanded ? "border-border-strong bg-surface-elevated" : "border-border bg-surface-elevated/60"
                }`}
              >
                <button
                  onClick={() => setOpen(expanded ? null : i)}
                  className="group flex w-full items-center justify-between gap-6 px-5 py-4 text-left cursor-pointer"
                  aria-expanded={expanded}
                >
                  <span className="font-medium tracking-tight text-text-primary">
                    {it.q}
                  </span>
                  <span
                    className={`grid h-8 w-8 flex-none place-items-center rounded-full border border-border bg-surface text-text-secondary transition-transform ${
                      expanded ? "rotate-45 border-violet text-violet" : ""
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <div className="px-5 pb-5 text-[15px] leading-relaxed text-text-secondary">
                        {it.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
