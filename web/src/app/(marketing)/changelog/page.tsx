import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Cta } from '@/components/Cta';
import { Container } from '@/components/mk/ui';
import { ChangelogList } from './ChangelogList';
import { RELEASES } from '@/content/changelog';

export const metadata: Metadata = {
  title: 'Changelog — shoppingmate',
  description: 'Every improvement to Olivia and the shoppingmate dashboard, newest first.',
};

export default function ChangelogPage() {
  const latest = RELEASES[0];
  return (
    <>
      <Nav />
      <main className="relative">
        <section className="relative overflow-hidden pb-10 pt-32 sm:pt-40">
          <div
            aria-hidden
            className="mk-halftone pointer-events-none absolute left-1/2 top-0 h-[380px] w-[1000px] -translate-x-1/2 opacity-[0.18]"
            style={{
              maskImage: 'radial-gradient(ellipse 50% 60% at 50% 0%, #000 30%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse 50% 60% at 50% 0%, #000 30%, transparent 75%)',
            }}
          />
          <Container className="relative">
            <p className="mb-4 text-[15px] font-medium text-[var(--mk-accent)]">Changelog</p>
            <h1 className="mk-h1 max-w-[760px] text-[clamp(40px,6.5vw,76px)] text-[#0b0b10]">What&apos;s new in shoppingmate.</h1>
            <p className="mt-5 max-w-[600px] text-[clamp(16px,1.7vw,19px)] leading-[1.55] text-[#4a4a55]">
              Every improvement to Olivia and your dashboard, newest first. Most updates reach your store automatically — there&apos;s nothing to install.
            </p>
            {latest && (
              <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#e8e8ee] bg-white px-3 py-1.5 text-[13px] font-medium text-[#4a4a55]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" />
                Latest update ·{' '}
                {new Date(`${latest.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
              </p>
            )}
          </Container>
        </section>
        <ChangelogList releases={RELEASES} />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
