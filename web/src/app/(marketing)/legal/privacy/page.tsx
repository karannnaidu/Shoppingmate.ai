import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — shoppingmate",
  description:
    "The shoppingmate privacy policy: what data the app accesses, why, how it is stored and retained, GDPR compliance webhooks, sub-processors, and your rights.",
};

// Compliant privacy-policy document (the public URL referenced in the Shopify
// App Store listing). Distinct from the marketing /privacy page: this is the
// legal text, mirroring shoppingmate/docs/PRIVACY.md.
export default function PrivacyPolicyPage() {
  return (
    <>
      <Nav />
      <main className="relative mx-auto max-w-3xl px-5 py-24 md:px-8 md:py-32">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
          Last updated: 18 July 2026
        </p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-text">
          <p>
            shoppingmate (&ldquo;we&rdquo;, &ldquo;our&rdquo;) provides an on-site shopping
            assistant that merchants install on their store. This policy explains what data the
            app accesses, why, and how it is handled.
          </p>

          <section className="space-y-4">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              What we access (and why)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-2 pr-4 font-semibold">Data</th>
                    <th className="py-2 pr-4 font-semibold">Source</th>
                    <th className="py-2 font-semibold">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/60 align-top">
                    <td className="py-2 pr-4">Product catalog (titles, prices, variants, images)</td>
                    <td className="py-2 pr-4">
                      Shopify Admin API (<code>read_products</code>) + your public{" "}
                      <code>/products.json</code>
                    </td>
                    <td className="py-2">
                      So the assistant can answer questions and recommend accurately
                    </td>
                  </tr>
                  <tr className="border-b border-border/60 align-top">
                    <td className="py-2 pr-4">
                      Orders (totals, line items, <code>note_attributes</code>)
                    </td>
                    <td className="py-2 pr-4">
                      Shopify Admin API (<code>read_orders</code>) + <code>orders/create</code>{" "}
                      webhook
                    </td>
                    <td className="py-2">
                      To attribute assisted conversions and report lift to you
                    </td>
                  </tr>
                  <tr className="border-b border-border/60 align-top">
                    <td className="py-2 pr-4">Store domains + shop profile</td>
                    <td className="py-2 pr-4">Shopify Admin API</td>
                    <td className="py-2">
                      To scope the assistant to your storefront and keep the catalog in sync
                    </td>
                  </tr>
                  <tr className="align-top">
                    <td className="py-2 pr-4">Anonymous visitor interactions</td>
                    <td className="py-2 pr-4">The storefront widget</td>
                    <td className="py-2">
                      To power the conversation and measure conversion; keyed by an anonymous
                      visitor id, not a Shopify customer identity
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              <strong>We do not</strong> request <code>read_customers</code>, we do not sell data,
              and cart/checkout run in the shopper&rsquo;s own browser session (Shopify owns
              payment — we never see or store payment details).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Storage &amp; retention
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Data is stored on our infrastructure (Railway/Vercel; US region) and encrypted in
                transit (TLS).
              </li>
              <li>
                Conversation/voice recordings, where enabled, are retained for a limited QA window
                and then deleted.
              </li>
              <li>
                On uninstall we stop processing; on <code>shop/redact</code> (48h after uninstall)
                we erase the shop&rsquo;s data.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              GDPR / privacy compliance
            </h2>
            <p>We implement Shopify&rsquo;s mandatory compliance webhooks:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <code>customers/data_request</code> — we acknowledge; the app stores no customer
                PII.
              </li>
              <li>
                <code>customers/redact</code> — no Shopify-customer-identified data is retained to
                erase.
              </li>
              <li>
                <code>shop/redact</code> — we delete the shop&rsquo;s stored data.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">Sub-processors</h2>
            <p>
              Shopify, Railway, Vercel, and the AI model providers used to generate responses
              (text + voice). Each processes data only to deliver the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Your rights &amp; contact
            </h2>
            <p>
              Merchants and their customers may request access or deletion of data we hold. Contact{" "}
              <a className="underline" href="mailto:privacy@shoppingmate.ai">
                privacy@shoppingmate.ai
              </a>
              . We respond within 30 days.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
