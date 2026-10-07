import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { SerifEm } from "@/components/v2/primitives";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { Privacy } from "@/components/Privacy";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Features — shoppingmate",
  description: "Voice and chat that sells: adds to cart, finds the best code, fills checkout and shows a tick for every real step. Plus customer requests, Store Insights and an owner dashboard.",
};


export default function FeaturesPage() {
  return (
    <>
      <Nav />
      <main className="relative">
                <PageHeader
          eyebrow="Features"
          title={<>Everything Olivia does, <SerifEm>out of the box.</SerifEm></>}
          subtitle="Voice and chat in one. She finds the right product, adds it to the cart, applies the best code and fills in checkout — and you see every step in your dashboard."
          primaryHref="/signup"
          primaryLabel="Get started — from $30/mo"
          secondaryHref="/demo"
          secondaryLabel="Talk to Olivia"
          stats={[
            { value: "Voice + chat", label: "in one" },
            { value: "8", label: "voices" },
            { value: "0", label: "card details seen" },
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
