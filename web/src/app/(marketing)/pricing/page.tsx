import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { SerifEm } from "@/components/v2/primitives";
import { Pricing } from "@/components/Pricing";
import { Faq } from "@/components/Faq";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Pricing — shoppingmate",
  description: "Starter $30, Growth $99, Scale $299 a month. Pay for conversations, not seats — voice and chat cost the same. Extra conversations $0.30 each.",
};


export default function PricingPage() {
  return (
    <>
      <Nav />
      <main className="relative">
                <PageHeader
          eyebrow="Pricing"
          title={<>Simple plans. <SerifEm>No seat fees.</SerifEm></>}
          subtitle="Every plan includes the full assistant — voice and chat. Choose by how many shopper conversations you expect each month. Top up anytime, cancel anytime."
          primaryHref="/signup"
          primaryLabel="Get started — from $30/mo"
          secondaryHref="#pricing"
          secondaryLabel="Compare plans"
          stats={[
            { value: "$30", label: "to start" },
            { value: "100–1,000", label: "conversations / mo" },
            { value: "$0.30", label: "per extra" },
          ]}
        />
        <Pricing hideHeading />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
