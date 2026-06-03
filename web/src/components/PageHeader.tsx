"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Stat = { value: string; label: string };

type Props = {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  stats?: Stat[];
};

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  primaryHref = "/signup",
  primaryLabel = "Get started — $30/mo",
  secondaryHref,
  secondaryLabel,
  stats,
}: Props) {
  return (
    <section className="relative overflow-hidden pt-14 md:pt-20 pb-12 md:pb-16">
      <div className="aurora" aria-hidden />
      <div className="absolute inset-0 grid-bg opacity-50" aria-hidden />

      <div className="relative z-10 mx-auto max-w-5xl px-5 md:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated/80 px-3 py-1.5 text-xs font-medium text-text-secondary backdrop-blur-md"
        >
          <Sparkles className="h-3.5 w-3.5 text-violet" />
          <span>{eyebrow}</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="mt-5 font-display text-4xl font-semibold tracking-tight text-balance md:text-5xl lg:text-6xl lg:leading-[1.05]"
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mt-5 max-w-2xl text-base text-text-secondary text-pretty md:text-lg"
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-8 flex flex-wrap justify-center items-center gap-3"
        >
          <Link
            href={primaryHref}
            className="group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-[15px] font-medium text-background shadow-[var(--shadow-md)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {primaryLabel}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          {secondaryHref && secondaryLabel && (
            <Link
              href={secondaryHref}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-6 py-3.5 text-[15px] font-medium text-text-primary transition-colors hover:border-border-strong"
            >
              {secondaryLabel}
            </Link>
          )}
        </motion.div>

        {stats && stats.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10 flex flex-wrap justify-center items-center gap-x-7 gap-y-3 text-sm text-text-muted"
          >
            {stats.map((s, i) => (
              <span key={s.label} className="inline-flex items-center gap-3">
                <span className="inline-flex items-baseline gap-1.5">
                  <span className="font-display text-[15px] font-semibold tabular-nums text-text-primary">
                    {s.value}
                  </span>
                  <span className="text-text-muted">{s.label}</span>
                </span>
                {i < stats.length - 1 && (
                  <span className="hidden sm:inline-block h-4 w-px bg-border" />
                )}
              </span>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
