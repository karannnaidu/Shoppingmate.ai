import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { SerifEm } from "@/components/v2/primitives";
import { InstallSteps } from "@/components/InstallSteps";
import { HowItWorks } from "@/components/HowItWorks";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Install — shoppingmate",
  description: "Sign up, copy one line, paste it into your site. Olivia learns your store on her own and goes live in minutes — no app, no plugin, no developer.",
};


export default function InstallPage() {
  return (
    <>
      <Nav />
      <main className="relative">
                <PageHeader
          eyebrow="Install"
          title={<>Live in <SerifEm>60 seconds.</SerifEm></>}
          subtitle="Sign up, copy your line, paste it into your site. Olivia reads your products and pages on her own, then greets your first shopper."
          primaryHref="/signup"
          primaryLabel="Create my account"
          secondaryHref="/platforms"
          secondaryLabel="Supported platforms"
          stats={[
            { value: "1 line", label: "to paste" },
            { value: "Minutes", label: "to learn your store" },
            { value: "0", label: "developers needed" },
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
