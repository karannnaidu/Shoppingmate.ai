"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Inbox, Lightbulb, MessageCircle, ShoppingBag, TrendingUp } from "lucide-react";
import { SectionHead, SerifEm } from "./v2/primitives";

// Illustrative preview of the owner dashboard (example numbers, labelled as such).
const stats = [
  { icon: TrendingUp, label: "Sales after a chat", value: "$4,210", delta: "+18%" },
  { icon: ShoppingBag, label: "Orders", value: "37", delta: "+9" },
  { icon: MessageCircle, label: "Conversations", value: "512", delta: "+64" },
];

const needs = [
  { icon: Inbox, tone: "amber", title: "2 customer requests", body: "Late delivery · callback before 6pm" },
  { icon: Lightbulb, tone: "violet", title: "Add a size guide to product pages", body: "31% of shoppers who ask about fit leave there" },
];

const funnel = [
  { label: "Talked to Olivia", v: 100 },
  { label: "Added to cart", v: 41 },
  { label: "Reached checkout", v: 18 },
  { label: "Ordered", v: 7 },
];

const points = [
  { title: "Answers, not charts", body: "One sentence tells you how the week went. Every number says what it means." },
  { title: "Everything she did, verified", body: "Open any conversation to see what Olivia said — and what really happened on your site." },
  { title: "Requests land with you", body: "Complaints, callbacks and order questions arrive with the shopper's name and number." },
];

export function OwnerDashboard() {
  return (
    <section id="dashboard" className="relative overflow-hidden border-y border-border bg-surface-muted/40 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHead
          eyebrow="For store owners"
          title={
            <>
              Know it&apos;s working — <SerifEm>in five seconds.</SerifEm>
            </>
          }
          subtitle="Your dashboard leads with the answer: what sold, who needs you, and the one fix worth making this week."
        />

        <div className="mt-14 grid items-start gap-10 lg:grid-cols-[1.35fr_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute -inset-4 rounded-[32px] bg-gradient-to-br from-violet/15 via-transparent to-signal/15 blur-2xl" aria-hidden />
            <div className="card-v2 relative overflow-hidden p-5 shadow-[var(--shadow-lg)] md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">Your store this week</p>
                  <p className="mt-2 max-w-md font-display text-xl font-semibold leading-snug tracking-[-0.02em] md:text-2xl">
                    Olivia talked to <span className="text-signal">512 shoppers</span> and helped close{" "}
                    <span className="text-signal">37 orders</span>.
                  </p>
                </div>
                <span className="hidden rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-muted sm:inline">
                  Example
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {stats.map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.25 + i * 0.1, duration: 0.45 }}
                    className="rounded-2xl border border-border bg-surface p-4"
                  >
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <s.icon className="h-3.5 w-3.5" />
                      {s.label}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-display text-2xl font-semibold tabular-nums tracking-tight">{s.value}</span>
                      <span className="text-xs font-medium text-signal">{s.delta}</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <p className="mb-2.5 text-xs font-medium text-text-muted">Needs you</p>
                  <div className="grid gap-2">
                    {needs.map((n, i) => (
                      <motion.div
                        key={n.title}
                        initial={{ opacity: 0, x: -8 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 + i * 0.12, duration: 0.4 }}
                        className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3"
                      >
                        <span
                          className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${
                            n.tone === "amber" ? "bg-amber-500/12 text-amber-500" : "bg-violet/12 text-violet"
                          }`}
                        >
                          <n.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{n.title}</span>
                          <span className="block text-xs text-text-secondary">{n.body}</span>
                        </span>
                        <ArrowUpRight className="ml-auto h-4 w-4 flex-none text-text-muted" />
                      </motion.div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2.5 text-xs font-medium text-text-muted">From chat to order</p>
                  <div className="grid gap-2.5">
                    {funnel.map((f, i) => (
                      <div key={f.label}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-text-secondary">{f.label}</span>
                          <span className="font-medium tabular-nums">{f.v}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                          <motion.div
                            initial={{ scaleX: 0 }}
                            whileInView={{ scaleX: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.4 + i * 0.12, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                            style={{ width: `${f.v}%`, transformOrigin: "left" }}
                            className="h-full rounded-full bg-gradient-to-r from-violet to-signal"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-6 lg:pt-6">
            {points.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="border-l-2 border-border pl-5 transition-colors hover:border-signal"
              >
                <h3 className="font-display text-lg font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-text-secondary">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
