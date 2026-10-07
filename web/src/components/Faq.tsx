"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";
import { SectionHead, SerifEm } from "./v2/primitives";

const items = [
  {
    q: "Do I need an app, a plugin or a developer?",
    a: "No. You paste one line into your site (or ask whoever manages it to). It works on Shopify, WooCommerce and any other website — there's nothing to install or maintain.",
  },
  {
    q: "My site is custom-built. Will it still work?",
    a: "Yes. Olivia works your page the way a shopper would — she reads it, taps the right buttons and fills in forms — so she doesn't need a special integration.",
  },
  {
    q: "Can it make things up, like prices or offers?",
    a: "Olivia answers from your own products, pages and documents. And every action she takes — adding to cart, applying a code, filling checkout — only shows a tick once your page confirms it. If something doesn't go through, she says so instead of pretending.",
  },
  {
    q: "What happens when a customer has a problem?",
    a: "Late delivery, a damaged parcel, a complaint or a callback request: Olivia takes their name and number, logs it as a customer request and emails your team. You'll see every request in your dashboard.",
  },
  {
    q: "Does it handle payments?",
    a: "Never. Olivia fills in the details, then the shopper pays on your own checkout. Card details never touch us.",
  },
  {
    q: "How many conversations will I need?",
    a: "A conversation is one shopper's visit with Olivia, however long, by voice or chat. Most stores start on Starter, watch usage in the dashboard, and top up ($0.30 each) or move up a plan when they're busy.",
  },
  {
    q: "Can I choose her voice and how she talks?",
    a: "Yes. Pick from eight voices and personalities in Settings and describe your brand's tone. Shoppers can talk in their own language — she replies in the same one.",
  },
  {
    q: "How long does setup take?",
    a: "About a minute to paste the line. Olivia then learns your store on her own — usually within a few minutes — and you're live.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-4xl px-5 md:px-8">
        <SectionHead
          eyebrow="FAQ"
          title={
            <>
              Questions owners <SerifEm>always ask.</SerifEm>
            </>
          }
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
                  expanded
                    ? "border-border-strong bg-surface-elevated shadow-[inset_0_1px_0_var(--highlight)]"
                    : "border-border bg-surface-elevated/60 hover:border-border-strong"
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
                      expanded ? "rotate-45 border-signal bg-signal-soft text-signal" : "group-hover:border-border-strong"
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
