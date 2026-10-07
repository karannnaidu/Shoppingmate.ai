"use client";

import { motion } from "framer-motion";
import { OliviaAvatar } from "./olivia/OliviaAvatar";
import { OliviaWaveform } from "./olivia/OliviaWaveform";
import { SectionHead, SerifEm } from "./v2/primitives";

const cards = [
  {
    n: "01",
    title: "Greets",
    body: "Says hello the moment someone lands — in your brand's tone, on every page — so no shopper browses alone.",
    visual: "greet" as const,
  },
  {
    n: "02",
    title: "Listens",
    body: "Real two-way voice, or chat if they prefer. Shoppers ask in their own words; Olivia answers from your products and policies.",
    visual: "listen" as const,
  },
  {
    n: "03",
    title: "Closes",
    body: "Adds the right size to the cart, applies the best code and fills in checkout. The shopper just taps Pay on your own checkout.",
    visual: "cart" as const,
  },
];

function Visual({ kind }: { kind: "greet" | "listen" | "cart" }) {
  return (
    <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0d0d12]">
      <div className="absolute inset-0 grid-bg opacity-25" aria-hidden />
      {kind === "greet" && (
        <div className="relative flex items-center gap-2.5 rounded-full border border-white/10 bg-black/60 py-1.5 pl-1.5 pr-4">
          <OliviaAvatar size="sm" presence="online" />
          <div className="leading-tight">
            <div className="text-[12.5px] font-semibold text-white">Olivia</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#3ddc97]">Hi there 👋</div>
          </div>
        </div>
      )}
      {kind === "listen" && (
        <div className="relative flex items-center gap-3 rounded-full border border-white/10 bg-black/60 px-4 py-2.5">
          <OliviaWaveform active speaking={false} />
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#3ddc97]">listening</span>
        </div>
      )}
      {kind === "cart" && (
        <div className="relative flex flex-col items-start gap-1.5">
          {["Added to your cart", "Applied WINTER15", "Filled in your details"].map((t, i) => (
            <motion.span
              key={t}
              initial={{ opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.35, duration: 0.35 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#3ddc97]/10 py-0.5 pl-1 pr-2.5 text-[11px] font-medium text-[#a7f3d0] ring-1 ring-inset ring-[#3ddc97]/25"
            >
              <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[#3ddc97] text-[8px] font-bold text-black">✓</span>
              {t}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}

export function MeetOlivia() {
  return (
    <section id="olivia" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHead
          eyebrow="Meet Olivia"
          title={
            <>
              Your best salesperson, <SerifEm>on every page.</SerifEm>
            </>
          }
          subtitle="Most shoppers leave without asking a single question. Olivia makes sure someone's always there to help them decide — and buy."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {cards.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="card-v2 card-v2-hover p-5"
            >
              <Visual kind={c.visual} />
              <div className="mt-6 flex items-baseline gap-3 px-1">
                <span className="font-mono text-xs text-text-muted">{c.n}</span>
                <h3 className="font-display text-2xl font-semibold tracking-[-0.02em]">{c.title}</h3>
              </div>
              <p className="mt-2 px-1 pb-1 text-[15px] leading-relaxed text-text-secondary text-pretty">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
