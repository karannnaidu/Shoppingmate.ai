import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { Faq } from "@/components/Faq";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "FAQ — shoppingmate",
  description: "Common questions about install, pricing, platforms, voice mode, brand KB, privacy, and what happens at checkout.",
};

export default function FaqPage() {
  return (
    <>
      <Nav />
      <main className="relative">
        <PageHeader
          eyebrow="FAQ"
          title={
            <>
              Questions, <span className="gradient-text">answered.</span>
            </>
          }
          subtitle="Install, pricing, platforms, voice mode, privacy, what Sage will and won't do — straight answers from the team building it."
          primaryHref="/signup"
          primaryLabel="Get started — $30/mo"
          secondaryHref="/demo"
          secondaryLabel="Try the demo"
        />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
