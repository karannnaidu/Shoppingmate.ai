import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { PageHeader } from "@/components/PageHeader";
import { SerifEm } from "@/components/v2/primitives";
import { Privacy } from "@/components/Privacy";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy & trust — shoppingmate",
  description: "We never see card details, conversations auto-delete after 24 hours, and your customers’ data stays yours.",
};


export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="relative">
                <PageHeader
          eyebrow="Privacy & trust"
          title={<>Your shoppers’ trust, <SerifEm>kept.</SerifEm></>}
          subtitle="Payment always happens on your own checkout. Conversations are deleted after a day. Contact details are only collected when a shopper asks for help — and go to you."
          primaryHref="/signup"
          primaryLabel="Get started — from $30/mo"
          secondaryHref="/legal/privacy"
          secondaryLabel="Read the privacy policy"
          stats={[
            { value: "0", label: "card details seen" },
            { value: "24h", label: "conversation retention" },
            { value: "Your", label: "checkout, always" },
          ]}
        />
        <Privacy />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
