import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { PageHeader } from '@/components/PageHeader';
import { Footer } from '@/components/Footer';
import { Cta } from '@/components/Cta';
import { MkHowItWorks } from '@/components/mk/HowItWorks';
import { MkPlatforms } from '@/components/mk/Why';

export const metadata: Metadata = {
  title: 'How it works — shoppingmate',
  description: 'Paste one line, Olivia learns your store, sells by voice and chat, and reports back every week.',
};

export default function HowItWorksPage() {
  return (
    <>
      <Nav />
      <main className="relative">
        <PageHeader
          eyebrow="How it works"
          title={<>One line in. <span className="text-[var(--mk-accent)]">A salesperson out.</span></>}
          subtitle="Paste a single line on your site. Olivia learns your products and policies on her own, sells to every shopper by voice and chat, and tells you what to fix each week."
          stats={[
            { value: '1', label: 'line to paste' },
            { value: 'Minutes', label: 'to go live' },
            { value: '24/7', label: 'on every page' },
          ]}
        />
        <MkHowItWorks />
        <MkPlatforms />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
