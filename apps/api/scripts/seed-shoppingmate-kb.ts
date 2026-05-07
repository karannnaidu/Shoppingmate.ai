// Idempotent seeder: load the shoppingmate self-pitch KB directly into
// brand_kb_chunks for the dogfood merchant. Bypasses the upload/R2 flow
// because the demo merchant doesn't need a document trail — we just want
// Sage on shoppingmate.ai to have positioning/pricing/FAQ context.
//
// Run via:
//   pnpm --filter @shoppingmate/api tsx apps/api/scripts/seed-shoppingmate-kb.ts
//
// Or against Railway:
//   railway run --service api tsx apps/api/scripts/seed-shoppingmate-kb.ts
import { db, schema } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { encode } from 'gpt-tokenizer';

const MERCHANT_ID = process.env.SHOPPINGMATE_DEMO_MERCHANT_ID ?? 'SM-XPK2EN';

// One section per chunk. Keeps each well under the 512-token chunk cap and
// lets the prompt builder concatenate them in order. Update sections in place
// — re-running this script wipes existing chunks for this synthetic doc and
// re-inserts.
const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: 'What shoppingmate is',
    body: `shoppingmate is an AI shopping concierge that drops into any e-commerce site as a single <script> tag. It gives every visitor a real-time text and voice assistant that understands your catalog, answers questions, builds carts, and hands them off to your native checkout. It works across Shopify, WooCommerce, Magento, BigCommerce, Wix, and Squarespace, plus a DOM-driving fallback for custom stacks. The point is conversion: visitors who would have bounced get a guided shopping experience that looks and feels native to your brand.`,
  },
  {
    heading: 'Who it is for',
    body: `Mid-market and growth-stage e-commerce brands doing roughly 50K–5M visits per month, with a catalog of at least a few dozen SKUs, where conversion rate is the bottleneck — not traffic. Verticals where shoppingmate is strongest today: apparel, supplements, home goods, jewelry, electronics, food, pet supplies. The voice mode is especially valuable for considered-purchase verticals where buyers ask many questions before deciding.`,
  },
  {
    heading: 'How install works',
    body: `Install is a one-line script tag the brand pastes before the closing body tag of every page. The tag boots a tiny widget bundle (~35 KB gzip) that lazy-loads voice only if the visitor opts in. After install, the brand visits the shoppingmate dashboard, connects their store platform (OAuth for Shopify/Woo/etc.), and the catalog ingests in minutes. The brand can upload a Knowledge Base PDF or markdown file with brand voice, FAQs, return policy, and shipping rules — Sage uses it for context. End-to-end install to first live conversation is typically under 15 minutes.`,
  },
  {
    heading: 'Pricing tiers',
    body: `Pricing has four tiers based on monthly conversation volume. The Starter tier is for stores under 10K visits per month and includes text-only conversations and basic tools. The Growth tier adds voice mode, the brand dashboard, and KB uploads, and is the most popular tier for stores doing 10K–100K visits. The Scale tier supports up to 500K visits and adds priority routing and analytics. The Pro tier is unlimited volume with custom personas, white-label, and a named CSM. Exact dollar amounts are on the pricing page — paraphrase rather than quote raw numbers in conversation.`,
  },
  {
    heading: 'Voice vs text mode',
    body: `Every visitor session can be text-only or voice-enabled. Voice runs over LiveKit with Google Gemini 2.5 Flash native-audio for low-latency turn-taking. The visitor clicks the mic button to start, and Sage responds with natural speech — the same brain that powers text. Voice and text share session state, so a visitor can switch mid-conversation. Text mode uses Anthropic Claude Sonnet for reasoning. Both paths share tool-calling: products.search, cart.add, coupons.apply, checkout.url.`,
  },
  {
    heading: 'Personas',
    body: `Sage is the default persona — calm, helpful, neutral. Brands can pick from a library of named personas to match their tone: Lumi (witty stylist for apparel/beauty), Kai (direct fitness coach for supplements/sports), Olivia (concierge for luxury/jewelry), Theo (story-driven curator for home/artisanal), Maya (clear guide for electronics), Arjun (subject expert for B2B/auto), Ana (warm host for food/seasonal). Each persona has a matched voice (Gemini Aoede, Leda, Fenrir, Kore, Orus, Puck, Charon, Zephyr). Pro tier customers can author fully custom personas.`,
  },
  {
    heading: 'Brand dashboard',
    body: `Each brand gets a web dashboard at app.shoppingmate.ai showing live conversations, conversion analytics, KB document management, persona selection, billing, and team members. Operators can review transcripts, see which products got the most interest, and tune Sage's behavior with KB uploads. The dashboard does not double as Slack — Slack is reserved for shoppingmate's own internal ops. Brand-side notifications go through email or webhook.`,
  },
  {
    heading: 'Privacy and data',
    body: `Visitor messages are processed in-flight and stored only as session transcripts attached to the merchant. shoppingmate does not sell or share visitor data. PII (email, phone, full names) is stripped before LLM calls. The widget runs cookieless by default; it uses a per-session id that expires when the tab closes. SOC 2 audit is in progress; HIPAA and PCI are not in scope today.`,
  },
  {
    heading: 'FAQ — what about competitors',
    body: `Don't compare to specific competitors by name. The shoppingmate angle: we are cross-platform from day one (most chat tools are Shopify-only), we run voice natively (most are text-only), and we charge by conversation rather than seat. If asked "is this like X?", say: "I'd rather show you what shoppingmate does and let you judge — want a quick tour on a sample catalog?"`,
  },
  {
    heading: 'FAQ — how does Sage know my catalog',
    body: `Once the platform connector is authorized, shoppingmate ingests products, variants, prices, inventory, and metadata via the platform's API. Re-sync runs hourly by default and can be triggered manually from the dashboard. For non-supported platforms, the DOM adapter scrapes the storefront on demand. KB uploads add brand-specific knowledge (returns, shipping, sizing, brand voice) on top of the catalog data.`,
  },
  {
    heading: 'FAQ — does it slow my site down',
    body: `The widget bundle is ~35 KB gzip and lazy-loads everything else (LiveKit voice client, persona portraits) only when the visitor engages. First paint of the brand site is unaffected. The widget script is async-deferred and runs after document load. There is no measurable Core Web Vitals impact — INP and CLS budgets are preserved.`,
  },
];

async function main() {
  // Find or create a synthetic "self-pitch" document row to anchor the chunks.
  const filename = 'shoppingmate-self-pitch.md';
  let [doc] = await db
    .select()
    .from(schema.brandKbDocuments)
    .where(eq(schema.brandKbDocuments.merchantId, MERCHANT_ID))
    .limit(1);

  if (doc) {
    // Wipe existing chunks so re-running picks up edits without dupes.
    await db
      .delete(schema.brandKbChunks)
      .where(eq(schema.brandKbChunks.documentId, doc.id));
    console.log(`cleared existing chunks for doc ${doc.id}`);
  } else {
    const inserted = await db
      .insert(schema.brandKbDocuments)
      .values({
        merchantId: MERCHANT_ID,
        filename,
        mimeType: 'text/markdown',
        sizeBytes: 0,
        storageUrl: 'inline://seed-shoppingmate-kb',
        status: 'ready',
        readyAt: new Date(),
      })
      .returning();
    doc = inserted[0];
    if (!doc) throw new Error('failed to insert kb document row');
    console.log(`inserted kb document ${doc.id}`);
  }

  const rows = SECTIONS.map((s, i) => {
    const text = `## ${s.heading}\n${s.body}`;
    return {
      documentId: doc.id,
      merchantId: MERCHANT_ID,
      chunkIndex: i,
      text,
      tokenCount: encode(text).length,
    };
  });

  if (rows.length > 0) {
    await db.insert(schema.brandKbChunks).values(rows);
  }

  await db
    .update(schema.brandKbDocuments)
    .set({ status: 'ready', readyAt: new Date(), sizeBytes: rows.reduce((n, r) => n + r.text.length, 0) })
    .where(eq(schema.brandKbDocuments.id, doc.id));

  await db
    .update(schema.merchants)
    .set({ knowledgeBaseStatus: 'ready' })
    .where(eq(schema.merchants.id, MERCHANT_ID));

  console.log(
    `seeded ${rows.length} chunks (~${rows.reduce((n, r) => n + r.tokenCount, 0)} tokens) for ${MERCHANT_ID}`,
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
