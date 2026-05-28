"use client";

import { motion } from "framer-motion";
import { Copy, Check, ArrowRight } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

const CDN_BASE = process.env.NEXT_PUBLIC_WIDGET_CDN_BASE || 'https://shoppingmate-web.vercel.app';
const snippet = `<script async\n  src="${CDN_BASE}/widget/v1.js"\n  data-id="SM-XXXX"></script>`;

export function Cta() {
  const [copied, setCopied] = useState(false);

  return (
    <section id="install" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-[32px] border border-border bg-foreground p-10 md:p-16 text-background"
        >
          {/* Mesh gradient backdrop */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-violet/40 blur-3xl" />
            <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-cyan/30 blur-3xl" />
            <div className="absolute inset-0 grid-bg opacity-30" />
          </div>

          <div className="relative grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-background/20 bg-background/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-background/70">
                <span className="h-1 w-1 rounded-full bg-cyan" />
                Install in 60 seconds
              </span>
              <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
                Paste this. Watch your conversion catch up to your traffic.
              </h2>
              <p className="mt-5 max-w-md text-background/70 text-pretty md:text-lg">
                Five paying beta merchants are live. We provision your merchantId in
                under an hour.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  aria-label="Sign up"
                  data-tour-stop="signup"
                  className="group inline-flex items-center gap-2 rounded-full bg-background px-6 py-3.5 text-[15px] font-medium text-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Get started — $30/mo
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 rounded-full border border-background/25 px-6 py-3.5 text-[15px] font-medium text-background transition-colors hover:bg-background/5"
                >
                  Hear it talk
                </Link>
              </div>
            </div>

            {/* Code block */}
            <div className="relative">
              <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-violet/30 via-fuchsia/15 to-cyan/30 blur-2xl" aria-hidden />
              <div className="relative rounded-2xl border border-background/15 bg-background/[0.06] backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-background/15 px-4 py-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-background/60">
                    HTML &lt;head&gt;
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(snippet.replace(/\\n/g, "\n"));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-background/70 transition-colors hover:bg-background/10 hover:text-background cursor-pointer"
                    aria-label="Copy snippet"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-cyan" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="overflow-x-auto px-5 py-5 font-mono text-[13px] leading-relaxed text-background/90">
                  {snippet}
                </pre>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
