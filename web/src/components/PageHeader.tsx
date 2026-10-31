import type { ReactNode } from "react";
import { AccentButton, Container, TalkButton } from "./mk/ui";

// Inner-page hero in the 2026-10-31 marketing style: big tight headline, one
// accent action, the live "Talk to Olivia" call, optional proof stats. Same
// props as before so every page picks it up unchanged.
type Stat = { value: string; label: string };

type Props = {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  primaryHref?: string;
  primaryLabel?: string;
  /** Kept for compatibility; the secondary action is always the live call. */
  secondaryHref?: string;
  secondaryLabel?: string;
  stats?: Stat[];
};

export function PageHeader({ eyebrow, title, subtitle, primaryHref = "/signup", primaryLabel = "Get started — from $30/mo", stats }: Props) {
  return (
    <section className="relative overflow-hidden pb-14 pt-32 sm:pb-20 sm:pt-40">
      <div
        aria-hidden
        className="mk-halftone pointer-events-none absolute left-1/2 top-0 h-[420px] w-[1000px] -translate-x-1/2 opacity-[0.2]"
        style={{
          maskImage: "radial-gradient(ellipse 50% 60% at 50% 0%, #000 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 50% 60% at 50% 0%, #000 30%, transparent 75%)",
        }}
      />
      <Container className="relative text-center">
        <p className="mb-5 text-[15px] font-medium text-[var(--mk-accent)]">{eyebrow}</p>
        <h1 className="mk-h1 mx-auto max-w-[920px] text-balance text-[clamp(40px,7vw,84px)] text-[#0b0b10]">{title}</h1>
        <p className="mx-auto mt-6 max-w-[620px] text-pretty text-[clamp(16px,1.7vw,20px)] leading-[1.55] text-[#4a4a55]">{subtitle}</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <AccentButton href={primaryHref}>{primaryLabel}</AccentButton>
          <TalkButton />
        </div>
        {stats && stats.length > 0 && (
          <dl className="mx-auto mt-12 grid max-w-[640px] grid-cols-3 divide-x divide-[#ececf2] rounded-2xl border border-[#ececf2] bg-white">
            {stats.map((s) => (
              <div key={s.label} className="px-3 py-4">
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-[clamp(18px,2.2vw,24px)] font-semibold tracking-[-0.02em] text-[#0b0b10]">{s.value}</dd>
                <dd className="mt-0.5 text-[12.5px] text-[#6e6e7a]">{s.label}</dd>
              </div>
            ))}
          </dl>
        )}
      </Container>
    </section>
  );
}
