import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { SerifEm } from "@/components/v2/primitives";
import { Faq } from "@/components/Faq";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "FAQ — shoppingmate",
  description: "Straight answers about setup, pricing, platforms, voice, customer requests, privacy and what happens at checkout.",
};


export default function FaqPage() {
  return (
    <>
      <Nav />
      <main className="relative">
                <PageHeader
          eyebrow="FAQ"
          title={<>Questions, <SerifEm>answered.</SerifEm></>}
          subtitle="Setup, pricing, platforms, voice, privacy — and exactly what Olivia will and won’t do on your store."
          primaryHref="/signup"
          primaryLabel="Get started — from $30/mo"
          secondaryHref="/demo"
          secondaryLabel="Talk to Olivia"
        />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
