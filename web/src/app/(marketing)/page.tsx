import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Platforms } from "@/components/Platforms";
import { HowItWorks } from "@/components/HowItWorks";
import { Demo } from "@/components/Demo";
import { Features } from "@/components/Features";
import { Privacy } from "@/components/Privacy";
import { Pricing } from "@/components/Pricing";
import { Faq } from "@/components/Faq";
import { Cta } from "@/components/Cta";
import { Footer } from "@/components/Footer";
import { WidgetPreview } from "@/components/WidgetPreview";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="relative">
        <Hero />
        <Platforms />
        <HowItWorks />
        <Demo />
        <Features />
        <Privacy />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <Footer />
      <WidgetPreview />
    </>
  );
}
