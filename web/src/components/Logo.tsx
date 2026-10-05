export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="relative inline-flex h-8 w-8">
        {/* Brand character (headset shopping assistant). The full wordmark logo
            lives at /shoppingmate-logo.webp for light surfaces; on the dark UI
            we use the character + a text wordmark. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/shoppingmate-icon.png"
          alt="shoppingmate"
          className="h-8 w-8 rounded-lg object-cover"
        />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan ring-2 ring-background" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">
        shoppingmate<span className="text-text-muted">.ai</span>
      </span>
    </div>
  );
}
