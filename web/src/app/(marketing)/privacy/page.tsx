import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { Privacy } from "@/components/Privacy";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy — shoppingmate",
  description: "No card data stored. PII minimized. Audit-friendly logs. Here's how shoppingmate handles data, retention, and compliance.",
};

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="relative">
        <PageHeader
          eyebrow="Privacy"
          title={
            <>
              Data handled <span className="gradient-text">with care.</span>
            </>
          }
          subtitle="No card data ever stored. PII minimized at every layer. Audit-friendly logs. Your customers' checkout still happens on your own native flow."
          primaryHref="/signup"
          primaryLabel="Get started — $30/mo"
          secondaryHref="mailto:hello@shoppingmate.ai?subject=DPA"
          secondaryLabel="Request DPA"
          stats={[
            { value: "0", label: "card data stored" },
            { value: "Native", label: "checkout handoff" },
            { value: "SOC 2", label: "on Enterprise" },
          ]}
        />
        <Privacy />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
