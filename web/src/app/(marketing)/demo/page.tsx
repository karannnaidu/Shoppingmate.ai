import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { SerifEm } from "@/components/v2/primitives";
import { Demo } from "@/components/Demo";
import { DemoTry } from "@/components/DemoTry";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Talk to Olivia — shoppingmate",
  description: "Hear Olivia live. Tap Call or type a question and watch her find products and work the page with you.",
};


export default function DemoPage() {
  return (
    <>
      <Nav />
      <main className="relative">
                <PageHeader
          eyebrow="Live demo"
          title={<>Talk to Olivia. <SerifEm>Right now.</SerifEm></>}
          subtitle="The assistant on this page is the same one your shoppers get. Tap Call to talk out loud, or type — ask about pricing, setup, or try a shopping question."
          primaryHref="/signup"
          primaryLabel="Get started — from $30/mo"
          secondaryHref="/features"
          secondaryLabel="See everything she does"
          stats={[
            { value: "Voice", label: "+ chat" },
            { value: "Real", label: "answers" },
            { value: "0", label: "setup" },
          ]}
        />
        <DemoTry />
        <Demo />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
