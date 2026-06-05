"use client";

import { motion } from "framer-motion";
import { SectionHead } from "./HowItWorks";
import { OliviaAvatar } from "./olivia/OliviaAvatar";
import { OliviaWaveform } from "./olivia/OliviaWaveform";

const cards = [
  {
    title: "She greets",
    body: "Olivia says hello the moment someone lands — by name of your brand, in your tone, on every page.",
    visual: "greet" as const,
  },
  {
    title: "She listens",
    body: "Real voice, both ways. Ask out loud and Olivia hears you, thinks, and answers in under a second.",
    visual: "listen" as const,
  },
  {
    title: "She builds the cart",
    body: "Picks the right variant, stacks coupons, and hands off to your native checkout. You never touch a card.",
    visual: "cart" as const,
  },
];

function Visual({ kind }: { kind: "greet" | "listen" | "cart" }) {
  return (
    <div className="flex h-28 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-900 to-black">
      {kind === "greet" && (
        <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-[#0a0a0a] py-1.5 pl-1.5 pr-3.5">
          <OliviaAvatar size="sm" presence="online" />
          <div className="leading-tight">
            <div className="text-[12.5px] font-semibold text-white">Olivia</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-400">
              Hi there 👋
            </div>
          </div>
        </div>
      )}
      {kind === "listen" && (
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#0a0a0a] px-4 py-2.5">
          <OliviaWaveform active speaking={false} />
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-400">
            listening
          </span>
        </div>
      )}
      {kind === "cart" && (
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0a0a0a] px-3.5 py-2.5 text-white">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
            +1
          </span>
          <span className="text-[12.5px]">Added to cart · WINTER15 applied</span>
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
          eyebrow="What she does"
          title="One assistant. The whole sales floor."
          subtitle="Olivia is the same voice on every page — greeting, listening, and closing — so your store is never silent."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {cards.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="rounded-3xl border border-border bg-surface-elevated p-6"
            >
              <Visual kind={c.visual} />
              <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">
                {c.title}
              </h3>
              <p className="mt-2 text-sm text-text-secondary text-pretty">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
