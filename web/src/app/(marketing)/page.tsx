import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { MeetOlivia } from "@/components/MeetOlivia";
import { OliviaStates } from "@/components/OliviaStates";
import { Platforms } from "@/components/Platforms";
import { HowItWorks } from "@/components/HowItWorks";
import { Features } from "@/components/Features";
import { OwnerDashboard } from "@/components/OwnerDashboard";
import { Privacy } from "@/components/Privacy";
import { Pricing } from "@/components/Pricing";
import { Faq } from "@/components/Faq";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";

// V2 story: hook → fits your store → meet Olivia → what she does → what you
// see → how to start → what shoppers see → price → trust → questions → go.
// The persona demo lives on /demo.
export default function Home() {
  return (
    <>
      <Nav />
      <main className="relative">
        <Hero />
        <Platforms />
        <MeetOlivia />
        <Features />
        <OwnerDashboard />
        <HowItWorks />
        <OliviaStates />
        <Pricing />
        <Privacy />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
