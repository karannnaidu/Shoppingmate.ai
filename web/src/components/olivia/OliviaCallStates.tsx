"use client";

import { motion } from "framer-motion";
import { Minus } from "lucide-react";
import { OliviaPill } from "./OliviaPill";
import type { OliviaPhase } from "./phases";

type StateSpec = {
  phase: OliviaPhase;
  label: string;
  blurb: string;
  panel?: "prompt" | "error";
};

const STATES: StateSpec[] = [
  {
    phase: "resting",
    label: "1 · At rest",
    blurb: "A small, calm launcher. Just “Talk to Olivia” and a green Call button.",
  },
  {
    phase: "incoming",
    label: "2 · Incoming call",
    blurb: "After a moment she rings — a magenta INCOMING CALL with a green Accept.",
  },
  {
    phase: "connecting",
    label: "3 · Asking for the mic",
    blurb: "Tap Call and she’s thinking — connecting and requesting microphone access.",
  },
  {
    phase: "error",
    label: "4 · If the mic is blocked",
    blurb: "Clear recovery copy and a one-tap retry. Never a dead end.",
    panel: "error",
  },
  {
    phase: "connected",
    label: "5 · Live & listening",
    blurb: "Connected. A live waveform, mute, and end — exactly like a real call.",
    panel: "prompt",
  },
];

function MiniPanel({ kind }: { kind: "prompt" | "error" }) {
  return (
    <div className="w-[260px] rounded-2xl border border-white/10 bg-[#0a0a0a] p-4 text-white shadow-[0_24px_48px_-16px_rgba(0,0,0,0.6)]">
      <div className="mb-2 flex items-start justify-between">
        {kind === "error" ? (
          <p className="pr-2 text-[13.5px] font-semibold leading-snug">
            Could not start the call. Please try again.
          </p>
        ) : (
          <h4 className="text-[15px] font-semibold tracking-tight">How can I help you?</h4>
        )}
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/60">
          <Minus className="h-3.5 w-3.5" />
        </span>
      </div>
      {kind === "error" ? (
        <p className="text-[12px] leading-relaxed text-white/55">
          Microphone blocked. Allow mic access in your browser, then tap Call.
        </p>
      ) : (
        <ul className="grid gap-1.5 text-[12.5px] text-white/80">
          {["Find the right product", "Compare options out loud", "Check out on this page"].map(
            (b) => (
              <li key={b} className="relative pl-4">
                <span className="absolute left-0 top-[7px] h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {b}
              </li>
            ),
          )}
        </ul>
      )}
      <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-white/30">
        Powered by shoppingmate
      </p>
    </div>
  );
}

export function OliviaCallStates() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {STATES.map((s, i) => (
        <motion.div
          key={s.phase + s.label}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45, delay: i * 0.05 }}
          className="flex flex-col rounded-3xl border border-border bg-surface-elevated p-6"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            {s.label}
          </span>
          {/* Dark stage so the dark pill reads on light + dark themes alike */}
          <div className="mt-4 flex min-h-[150px] flex-col items-start justify-center gap-3 rounded-2xl bg-gradient-to-br from-zinc-900 to-black p-5">
            {s.panel && <MiniPanel kind={s.panel} />}
            <OliviaPill phase={s.phase} />
          </div>
          <p className="mt-4 text-sm text-text-secondary text-pretty">{s.blurb}</p>
        </motion.div>
      ))}
    </div>
  );
}
