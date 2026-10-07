import Link from "next/link";
import { Logo } from "./Logo";

// Only real destinations — no placeholder "#" links.
const cols = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Platforms", href: "/platforms" },
      { label: "Talk to Olivia", href: "/demo" },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "Install", href: "/install" },
      { label: "Create account", href: "/signup" },
      { label: "Log in", href: "/login" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "FAQ", href: "/faq" },
      { label: "Privacy & trust", href: "/privacy" },
      { label: "Privacy policy", href: "/legal/privacy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-border bg-surface-muted/40">
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-sm font-display text-2xl font-semibold leading-tight tracking-[-0.03em]">
              Your store, <span className="serif-em">finally</span> talking back.
            </p>
            <p className="mt-4 text-sm text-text-secondary">
              Questions? <span className="text-text-primary">hello@shoppingmate.ai</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {cols.map((c) => (
              <div key={c.title}>
                <h4 className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">{c.title}</h4>
                <ul className="mt-4 grid gap-2.5">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href} className="text-sm text-text-secondary transition-colors hover:text-text-primary">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col-reverse gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-muted">© {new Date().getFullYear()} shoppingmate.ai</p>
          <p className="flex items-center gap-2 text-xs text-text-muted">
            <span className="rounded-full border border-border px-2 py-0.5 font-mono uppercase tracking-wider">v2.0</span>
            Never sees card details.
          </p>
        </div>
      </div>
    </footer>
  );
}
