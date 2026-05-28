"use client";

import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";

const links = [
  { href: "/features", label: "Features" },
  { href: "/platforms", label: "Platforms" },
  { href: "/pricing", label: "Pricing" },
  { href: "/install", label: "Install" },
  { href: "/faq", label: "FAQ" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b transition-[background-color,backdrop-filter,border-color] duration-300 ${
        scrolled
          ? "border-border bg-surface/80 backdrop-blur-xl"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        <Link href="/" className="group">
          <Logo />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="relative rounded-full px-4 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary group"
            >
              <span className="relative z-10">{l.label}</span>
              <span className="absolute inset-0 rounded-full bg-surface-muted opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/signup"
            aria-label="Sign up"
            data-tour-stop="signup-nav"
            className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Get started
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => setOpen(!open)}
            aria-label="Menu"
            className="md:hidden grid h-9 w-9 place-items-center rounded-full border border-border bg-surface-elevated"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden border-t border-border bg-surface px-5 py-4"
        >
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-base text-text-secondary hover:bg-surface-muted hover:text-text-primary"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background"
            >
              Get started
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>
      )}
    </header>
  );
}
