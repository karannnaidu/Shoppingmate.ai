import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { InstallSteps } from "@/components/InstallSteps";
import { HowItWorks } from "@/components/HowItWorks";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Install — shoppingmate",
  description: "Paste one script tag. Sage is live on your storefront in 5–8 minutes — no SDK, no OAuth, no plugin.",
};

export default function InstallPage() {
  return (
    <>
      <Nav />
      <main className="relative">
        <PageHeader
          eyebrow="Install"
          title={
            <>
              Live in <span className="gradient-text">60 seconds.</span>
            </>
          }
          subtitle="Sign up. Paste one script tag. We auto-onboard your storefront and run a smoke test before Sage greets your first visitor."
          primaryHref="/signup"
          primaryLabel="Sign up — get my snippet"
          secondaryHref="/platforms"
          secondaryLabel="See supported platforms"
          stats={[
            { value: "1 line", label: "of code" },
            { value: "5–8 min", label: "auto-onboard" },
            { value: "0", label: "PCI scope" },
          ]}
        />
        <InstallSteps />
        <HowItWorks />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
