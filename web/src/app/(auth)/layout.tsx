import Link from 'next/link';
import { Logo } from '@/components/Logo';

const steps = [
  'Create your account — no password',
  'Copy your line and paste it into your site',
  'Olivia learns your store and starts greeting shoppers',
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh bg-background text-text-primary lg:grid-cols-[1fr_1.05fr]">
      {/* Brand panel (desktop) */}
      <aside className="grain relative hidden overflow-hidden border-r border-white/[0.06] bg-[#0b0b10] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-violet/30 blur-[110px]" aria-hidden />
        <div className="absolute -bottom-32 right-0 h-[24rem] w-[24rem] rounded-full bg-[#3ddc97]/15 blur-[110px]" aria-hidden />
        <div className="absolute inset-0 grid-bg opacity-20" aria-hidden />
        <Link href="/" className="relative z-10">
          <Logo />
        </Link>
        <div className="relative z-10 mt-auto max-w-md">
          <p className="font-display text-5xl font-semibold leading-[1.03] tracking-[-0.045em]">
            Your store, <span className="serif-em">finally</span> talking back.
          </p>
          <ol className="mt-10 grid gap-3.5">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-3 text-[15px] text-white/80">
                <span
                  className="tick-pop grid h-6 w-6 flex-none place-items-center rounded-full bg-[#3ddc97] text-[11px] font-bold text-black"
                  style={{ animationDelay: `${300 + i * 220}ms` }}
                >
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
          <p className="mt-10 text-xs text-white/40">Plans from $30/month · cancel anytime · we never see card details</p>
        </div>
      </aside>

      {/* Form side */}
      <div className="relative flex min-h-dvh flex-col">
        <div className="aurora opacity-60 lg:hidden" aria-hidden />
        <header className="relative z-10 flex w-full items-center justify-between px-5 py-6 md:px-10">
          <Link href="/" className="lg:invisible">
            <Logo />
          </Link>
          <Link href="/" className="text-sm text-text-secondary transition-colors hover:text-text-primary">
            ← Back to site
          </Link>
        </header>
        <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-16 md:px-10">
          <div className="dash-enter w-full max-w-[400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
