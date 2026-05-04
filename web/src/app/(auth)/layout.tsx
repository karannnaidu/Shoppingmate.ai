import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh flex flex-col bg-background text-text-primary">
      <div className="aurora" aria-hidden />
      <div className="absolute inset-0 grid-bg opacity-50" aria-hidden />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 md:px-8">
        <Link href="/" className="group">
          <Logo />
        </Link>
        <Link
          href="/"
          className="text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          ← Back to site
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-16 md:px-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
