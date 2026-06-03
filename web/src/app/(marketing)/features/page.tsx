import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { Privacy } from "@/components/Privacy";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Features — shoppingmate",
  description: "Voice + chat, cart actions, coupon discovery, brand KB, personas, and conversion attribution — out of the box.",
};

export default function FeaturesPage() {
  return (
    <>
      <Nav />
      <main className="relative">
        <PageHeader
          eyebrow="Features"
          title={
            <>
              Everything Sage does, <span className="gradient-text">out of the box.</span>
            </>
          }
          subtitle="Voice and chat in one widget. Cart actions, coupon discovery, brand-aware answers, and attribution — no integrations, no plugins, no PCI scope."
          primaryHref="/signup"
          primaryLabel="Get started — $30/mo"
          secondaryHref="/demo"
          secondaryLabel="Hear it talk"
          stats={[
            { value: "8", label: "personas" },
            { value: "Voice + chat", label: "in one widget" },
            { value: "0", label: "card data stored" },
          ]}
        />
        <Features />
        <HowItWorks />
        <Privacy />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
