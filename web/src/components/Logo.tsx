export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background shadow-[var(--shadow-sm)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5"
          aria-hidden
        >
          <defs>
            <linearGradient id="lg-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#a78bfa" />
              <stop offset="1" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <path
            d="M5 8.5C5 6.567 6.567 5 8.5 5h7C17.433 5 19 6.567 19 8.5v.5l-1.4 8.4A3 3 0 0 1 14.64 20H9.36a3 3 0 0 1-2.96-2.6L5 9v-.5Z"
            stroke="url(#lg-grad)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="13" r="2" fill="url(#lg-grad)" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan ring-2 ring-foreground" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">
        shoppingmate<span className="text-text-muted">.ai</span>
      </span>
    </div>
  );
}
