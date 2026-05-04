"use client";

import { motion } from "framer-motion";

const platforms = [
  { name: "Shopify", glyph: "S" },
  { name: "WooCommerce", glyph: "W" },
  { name: "Magento", glyph: "M" },
  { name: "BigCommerce", glyph: "BC" },
  { name: "Wix", glyph: "Wx" },
  { name: "Squarespace", glyph: "Sq" },
  { name: "Custom HTML", glyph: "</>" },
];

export function Platforms() {
  return (
    <section id="platforms" className="relative border-y border-border bg-surface-muted/40">
      <div className="mx-auto max-w-7xl px-5 md:px-8 py-12 md:py-16">
        <div className="flex flex-col items-center text-center">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
            One script. Every storefront.
          </span>
          <h2 className="mt-3 max-w-2xl font-display text-2xl font-semibold tracking-tight md:text-3xl">
            Detects your platform on first crawl.
          </h2>
        </div>

        <div className="relative mt-10 overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-background to-transparent" />
          <div className="flex w-max marquee gap-3">
            {[...platforms, ...platforms].map((p, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -2 }}
                className="group flex min-w-[180px] items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 transition-colors hover:border-border-strong"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-violet/15 to-cyan/15 font-mono text-sm font-semibold text-violet group-hover:from-violet/25 group-hover:to-cyan/25 transition-colors">
                  {p.glyph}
                </span>
                <span className="text-sm font-medium">{p.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
