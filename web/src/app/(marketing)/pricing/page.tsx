import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { Pricing } from "@/components/Pricing";
import { Faq } from "@/components/Faq";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Pricing — shoppingmate",
  description: "Flat monthly pricing. Unmetered conversations on every plan. No per-seat fees, no card surprises.",
};

export default function PricingPage() {
  return (
    <>
      <Nav />
      <main className="relative">
        <PageHeader
          eyebrow="Pricing"
          title={
            <>
              Flat monthly. <span className="gradient-text">Unmetered conversations.</span>
            </>
          }
          subtitle="Pick the plan that fits your stage. Every plan ships with the full voice + chat agent, brand KB, and conversion attribution. Cancel anytime."
          primaryHref="/signup"
          primaryLabel="Get started — $30/mo"
          secondaryHref="#pricing"
          secondaryLabel="See plans"
          stats={[
            { value: "$30", label: "starter" },
            { value: "Unlimited", label: "conversations" },
            { value: "0", label: "per-seat fees" },
          ]}
        />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
