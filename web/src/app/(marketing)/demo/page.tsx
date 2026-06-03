import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { Demo } from "@/components/Demo";
import { DemoTry } from "@/components/DemoTry";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Demo — shoppingmate",
  description: "Hear Sage in action. Tap the orb, ask anything — voice or text — and watch the agent drive the page with you.",
};

export default function DemoPage() {
  return (
    <>
      <Nav />
      <main className="relative">
        <PageHeader
          eyebrow="Live demo"
          title={
            <>
              Hear Sage <span className="gradient-text">in action.</span>
            </>
          }
          subtitle="The chat orb on this page is the same agent that ships to every merchant. Ask it about pricing, install, or pick a vertical to see real product cards appear."
          primaryHref="/signup"
          primaryLabel="Get started — $30/mo"
          secondaryHref="/features"
          secondaryLabel="See features"
          stats={[
            { value: "Voice", label: "+ text" },
            { value: "Real", label: "catalogs" },
            { value: "0", label: "demo setup" },
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
