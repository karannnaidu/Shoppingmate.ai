import type { ReactNode } from "react";

// V2 marketing primitives. Headlines use Geist with 1–3 words in Instrument
// Serif italic (<SerifEm>); eyebrows are small mono labels with a signal dot.

export function SerifEm({ children }: { children: ReactNode }) {
  return <em className="serif-em">{children}</em>;
}

export function Eyebrow({ children, tone = "violet" }: { children: ReactNode; tone?: "violet" | "signal" }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated/80 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted backdrop-blur-sm">
      <span className={`h-1.5 w-1.5 rounded-full ${tone === "signal" ? "bg-signal" : "bg-violet"}`} />
      {children}
    </span>
  );
}

export function Tick({ className = "", animate = false }: { className?: string; animate?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid h-4 w-4 flex-none place-items-center rounded-full bg-signal text-[10px] font-bold text-background ${
        animate ? "tick-pop" : ""
      } ${className}`}
    >
      ✓
    </span>
  );
}

export function SectionHead({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={`flex flex-col ${align === "center" ? "items-center text-center" : "items-start text-left"} gap-4`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="max-w-3xl font-display text-[2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-balance md:text-[3.25rem]">
        {title}
      </h2>
      {subtitle && <p className="max-w-2xl text-[17px] leading-relaxed text-text-secondary text-pretty md:text-lg">{subtitle}</p>}
    </div>
  );
}
