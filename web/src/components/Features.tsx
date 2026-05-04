"use client";

import { motion } from "framer-motion";
import {
  Mic,
  ShieldCheck,
  Zap,
  BookOpenText,
  Wand2,
  ChartLine,
} from "lucide-react";
import { SectionHead } from "./HowItWorks";

const features = [
  {
    icon: Mic,
    title: "Voice + text, 8 personas",
    body:
      "Whisper STT + ElevenLabs TTS, with eight pre-built personas. Pick your tone — calm clinician, witty stylist, no-nonsense gym coach.",
    accent: "violet",
  },
  {
    icon: BookOpenText,
    title: "Trained on your brand",
    body:
      "Upload PDFs, FAQs, returns and shipping copy. The agent quotes your docs verbatim — never guesses, never hallucinates pricing.",
    accent: "cyan",
  },
  {
    icon: Wand2,
    title: "Self-healing selectors",
    body:
      "Daily recrawl detects broken triggers. The agent auto-heals — and your overrides stay locked, immune to recrawl drift.",
    accent: "fuchsia",
  },
  {
    icon: Zap,
    title: "Coupons that actually work",
    body:
      "Discovers active codes, ranks the best one against the live cart, and auto-applies — visitor confirms or it stacks silently. Your pick.",
    accent: "violet",
  },
  {
    icon: ShieldCheck,
    title: "Zero PCI scope",
    body:
      "We never see card data. Payment is always a redirect to your native checkout. Conversation transcripts auto-expire at 24 hours.",
    accent: "cyan",
  },
  {
    icon: ChartLine,
    title: "Conversion attribution",
    body:
      "Every sale closed through the agent is attributed back to a session. Reconciles to within 0.5% of cost-ledger totals.",
    accent: "fuchsia",
  },
];

const accentMap = {
  violet: "from-violet/20 to-violet/0 text-violet",
  cyan: "from-cyan/20 to-cyan/0 text-cyan",
  fuchsia: "from-fuchsia/20 to-fuchsia/0 text-fuchsia",
};

export function Features() {
  return (
    <section id="features" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHead
          eyebrow="What it does"
          title="Built like a sales floor — runs like a system."
          subtitle="Not a chatbot. Not a coupon banner. A full agent runtime, on your storefront."
        />

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.04 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-surface-elevated p-6 transition-all hover:border-border-strong hover:shadow-[var(--shadow-md)]"
            >
              <span
                className={`absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60 ${accentMap[f.accent as keyof typeof accentMap]}`}
                aria-hidden
              />
              <div className="relative">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-surface text-text-secondary transition-colors group-hover:border-border-strong group-hover:text-text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-text-secondary">
                  {f.body}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
