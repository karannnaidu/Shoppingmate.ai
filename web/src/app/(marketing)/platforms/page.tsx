import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { SerifEm } from "@/components/v2/primitives";
import { Platforms } from "@/components/Platforms";
import { HowItWorks } from "@/components/HowItWorks";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Platforms — shoppingmate",
  description: "Works on Shopify, WooCommerce, Wix, Squarespace, BigCommerce, Magento and any custom website — the same single line everywhere.",
};


export default function PlatformsPage() {
  return (
    <>
      <Nav />
      <main className="relative">
                <PageHeader
          eyebrow="Platforms"
          title={<>One line. <SerifEm>Any store.</SerifEm></>}
          subtitle="Shopify, WooCommerce, Wix, Squarespace, BigCommerce, Magento or something custom-built — Olivia works the page the way a shopper would, so there’s nothing to integrate."
          primaryHref="/signup"
          primaryLabel="Get started — from $30/mo"
          secondaryHref="/install"
          secondaryLabel="See how to install"
          stats={[
            { value: "1", label: "line to paste" },
            { value: "0", label: "apps or plugins" },
            { value: "Minutes", label: "to go live" },
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
