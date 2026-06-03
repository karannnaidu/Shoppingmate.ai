import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { Platforms } from "@/components/Platforms";
import { HowItWorks } from "@/components/HowItWorks";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Platforms — shoppingmate",
  description: "Live on Shopify, WooCommerce, Magento, BigCommerce, Wix, Squarespace, and custom HTML — same script tag everywhere.",
};

export default function PlatformsPage() {
  return (
    <>
      <Nav />
      <main className="relative">
        <PageHeader
          eyebrow="Platforms"
          title={
            <>
              One script. <span className="gradient-text">Every storefront.</span>
            </>
          }
          subtitle="Shopify, WooCommerce, Magento, BigCommerce, Wix, Squarespace, and custom HTML. Same paste, same agent, same install time."
          primaryHref="/signup"
          primaryLabel="Get started — $30/mo"
          secondaryHref="/install"
          secondaryLabel="See the snippet"
          stats={[
            { value: "7", label: "platforms" },
            { value: "1", label: "script tag" },
            { value: "5–8 min", label: "to live" },
          ]}
        />
        <Platforms />
        <HowItWorks />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
