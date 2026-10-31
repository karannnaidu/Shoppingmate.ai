import { MkNav } from '@/components/mk/Nav';
import { MkHero } from '@/components/mk/Hero';
import { MkPlatforms, MkWhy } from '@/components/mk/Why';
import { MkHowItWorks } from '@/components/mk/HowItWorks';
import { MkCapabilities } from '@/components/mk/Capabilities';
import { MkFaq, MkFinalCta, MkFooter, MkPricing } from '@/components/mk/Closing';

// 2026-10-31 redesign (docs/superpowers/specs/2026-10-31-marketing-site-redesign-prd.md):
// hook + live demo → works on your store → why you're losing sales → how it
// works → what she does → price → questions → go.
export default function Home() {
  return (
    <>
      <MkNav />
      <main className="relative">
        <MkHero />
        <MkPlatforms />
        <MkWhy />
        <MkHowItWorks />
        <MkCapabilities />
        <MkPricing />
        <MkFaq />
        <MkFinalCta />
      </main>
      <MkFooter />
    </>
  );
}
