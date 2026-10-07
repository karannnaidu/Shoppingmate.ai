"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Code2, ScanSearch, Sparkles } from "lucide-react";
import { useRef } from "react";
import { SectionHead, SerifEm } from "./v2/primitives";

// Kept for existing imports (`import { SectionHead } from "./HowItWorks"`).
export { SectionHead };

const CDN_BASE = process.env.NEXT_PUBLIC_WIDGET_CDN_BASE || "https://shoppingmate-web.vercel.app";

const steps = [
  {
    n: "01",
    icon: Code2,
    title: "Paste one line",
    body: "Add a single line to your site — or ask whoever runs it. No app to install, no plugin, nothing to configure.",
    panel: { kind: "code" as const, text: `<script async\n  src="${CDN_BASE}/widget/v1.js"\n  data-id="SM-XXXX"></script>` },
  },
  {
    n: "02",
    icon: ScanSearch,
    title: "Olivia learns your store",
    body: "She reads your products, prices, FAQs, shipping and returns, and maps every page type. Usually done in a few minutes.",
    panel: {
      kind: "checks" as const,
      items: ["Found 482 products", "Read shipping & returns", "Mapped product, cart and checkout pages", "Ready to talk"],
    },
  },
  {
    n: "03",
    icon: Sparkles,
    title: "She sells — and shows her work",
    body: "Shoppers talk or type; Olivia helps them choose and checks them out. You see every conversation, sale and request in your dashboard.",
    panel: {
      kind: "checks" as const,
      items: ["Added Hydra Soothe to cart", "Applied WINTER15", "Filled in checkout details", "Order placed on your checkout"],
    },
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 30%"] });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section id="how" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHead
          eyebrow="How it works"
          title={
            <>
              Live on your store <SerifEm>before lunch.</SerifEm>
            </>
          }
          subtitle="No developers, no integrations to maintain. If you can paste a line of text, you can do this."
        />

        <div ref={ref} className="relative mt-16 grid gap-10">
          <div className="pointer-events-none absolute bottom-2 left-[42px] top-2 hidden w-px bg-border md:block">
            <motion.div style={{ height: lineHeight }} className="absolute left-0 top-0 w-px bg-gradient-to-b from-violet to-signal" />
          </div>

          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 gap-5 md:grid-cols-[88px_1fr_1fr] md:items-center md:gap-10"
            >
              <div className="hidden h-22 w-22 items-center justify-center md:flex">
                <div className="card-v2 relative grid h-14 w-14 place-items-center text-text-secondary">
                  <s.icon className="h-5 w-5" />
                  <span className="absolute -bottom-2 -right-2 grid h-7 w-7 place-items-center rounded-full bg-foreground text-[11px] font-semibold tabular-nums text-background">
                    {s.n}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-text-muted md:hidden">Step {s.n}</span>
                <h3 className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em] md:text-3xl">{s.title}</h3>
                <p className="mt-3 max-w-md text-[16px] leading-relaxed text-text-secondary text-pretty">{s.body}</p>
              </div>

              <div className="relative">
                <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-violet/10 to-signal/10 opacity-70 blur-xl" aria-hidden />
                <div className="relative rounded-2xl border border-white/10 bg-[#0d0d12] p-4 text-white shadow-[var(--shadow-md)]">
                  <div className="mb-3 flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-white/15" />
                    <i className="h-2 w-2 rounded-full bg-white/15" />
                    <i className="h-2 w-2 rounded-full bg-white/15" />
                  </div>
                  {s.panel.kind === "code" ? (
                    <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-white/85">{s.panel.text}</pre>
                  ) : (
                    <ul className="grid gap-2">
                      {s.panel.items.map((it, j) => (
                        <motion.li
                          key={it}
                          initial={{ opacity: 0, x: -6 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true, margin: "-60px" }}
                          transition={{ delay: 0.15 + j * 0.25, duration: 0.35 }}
                          className="flex items-center gap-2.5 text-[13.5px] text-white/85"
                        >
                          <span className="grid h-4 w-4 place-items-center rounded-full bg-[#3ddc97] text-[10px] font-bold text-black">✓</span>
                          {it}
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
