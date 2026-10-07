"use client";

import { motion } from "framer-motion";
import { Check, Copy, UserPlus, Code2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const CDN_BASE = process.env.NEXT_PUBLIC_WIDGET_CDN_BASE || 'https://shoppingmate-web.vercel.app';

const steps = [
  {
    n: "01",
    icon: UserPlus,
    title: "Create your account",
    body: "Sign up with your email. Your personal line is ready straight away — no sales call, no contract.",
    cta: { label: "Sign up", href: "/signup" },
  },
  {
    n: "02",
    icon: Code2,
    title: "Paste one line",
    body: "Paste it into your site's header — or send it to whoever runs your site. No app, no plugin, no developer needed.",
  },
  {
    n: "03",
    icon: Sparkles,
    title: "Olivia learns your store",
    body: "She reads your products, prices and policies, maps your cart and checkout, and checks everything works. Usually live within minutes.",
  },
];

export function InstallSteps() {
  const [copied, setCopied] = useState(false);
  const snippet = `<script async\n  src="${CDN_BASE}/widget/v1.js"\n  data-id="SM-XXXX"></script>`;

  return (
    <section className="relative py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="grid gap-7">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                className="flex gap-4"
              >
                <div className="card-v2 grid h-11 w-11 shrink-0 place-items-center">
                  <s.icon className="h-5 w-5 text-signal" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-text-muted">{s.n}</span>
                    <h3 className="font-display text-lg font-semibold tracking-tight">
                      {s.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary md:text-base">{s.body}</p>
                  {s.cta && (
                    <Link
                      href={s.cta.href}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-violet hover:underline"
                    >
                      {s.cta.label} →
                    </Link>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative"
          >
            <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-violet/20 via-transparent to-signal/20 blur-2xl opacity-70" aria-hidden />
            <div className="relative rounded-[22px] border border-border bg-surface-elevated/95 backdrop-blur-xl shadow-[var(--shadow-lg)]">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
                  index.html · &lt;head&gt;
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(snippet);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }}
                  aria-label="Copy snippet"
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-signal" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto px-5 py-5 font-mono text-[13px] leading-relaxed text-text-primary">
                {snippet}
              </pre>
              <div className="border-t border-border px-5 py-3 text-[11px] font-mono text-text-muted">
                Your dashboard shows this line with your own ID filled in.
              </div>
            </div>

            <div className="card-v2 mt-4 grid gap-2 px-4 py-4 text-[13px] text-text-secondary">
              <div className="flex items-center gap-2"><span className="text-signal">✓</span> Recognised your store (Shopify)</div>
              <div className="flex items-center gap-2"><span className="text-signal">✓</span> Learned 482 products</div>
              <div className="flex items-center gap-2"><span className="text-signal">✓</span> Mapped cart, checkout and discount codes</div>
              <div className="flex items-center gap-2"><span className="text-signal">✓</span> Test conversation passed</div>
              <div className="flex items-center gap-2"><span className="text-signal">●</span> Live — Olivia is greeting shoppers</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
