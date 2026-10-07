"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow } from "./v2/primitives";

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

const ease = [0.22, 1, 0.36, 1] as const;

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  primaryHref = "/signup",
  primaryLabel = "Get started — from $30/mo",
  secondaryHref,
  secondaryLabel,
  stats,
}: Props) {
  return (
    <section className="grain relative overflow-hidden pb-14 pt-14 md:pb-20 md:pt-24">
      <div className="aurora" aria-hidden />
      <div className="absolute inset-0 grid-bg opacity-50" aria-hidden />

      <div className="relative z-10 mx-auto max-w-5xl px-5 text-center md:px-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease }}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease }}
          className="mt-6 font-display text-[2.6rem] font-semibold leading-[1.03] tracking-[-0.045em] text-balance md:text-6xl lg:text-7xl"
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease }}
          className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-text-secondary text-pretty md:text-lg"
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.16, ease }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
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
          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mx-auto mt-12 grid max-w-2xl grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-surface-elevated/60 backdrop-blur-sm"
          >
            {stats.map((s) => (
              <div key={s.label} className="px-3 py-4">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-lg font-semibold tabular-nums tracking-tight text-text-primary md:text-xl">{s.value}</dd>
                <dd className="mt-0.5 text-xs text-text-muted">{s.label}</dd>
              </div>
            ))}
          </motion.dl>
        )}
      </div>
    </section>
  );
}
