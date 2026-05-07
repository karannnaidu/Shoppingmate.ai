// Idempotent seeder: 25 demo products across 5 verticals attached to the
// dogfood merchant (SM-XPK2EN). The shoppingmate.ai widget runs in demoMode
// for this merchant; when a visitor picks a vertical, Sage searches the
// catalog by vertical keyword (e.g. "dog food") and these rows surface as
// real product cards with images, prices, and click-through URLs.
//
// Re-running this script clears existing showcase rows (source='showcase')
// and re-inserts so edits to the catalog are picked up cleanly. Real
// merchant catalogs are untouched (different source value).
//
// Run via:
//   pnpm --filter @shoppingmate/api tsx apps/api/scripts/seed-shoppingmate-showcase.ts
//
// Or against Railway:
//   railway run --service api tsx apps/api/scripts/seed-shoppingmate-showcase.ts
import { db, schema } from '@shoppingmate/db';
import { and, eq } from 'drizzle-orm';

const MERCHANT_ID = process.env.SHOPPINGMATE_DEMO_MERCHANT_ID ?? 'SM-XPK2EN';
const SOURCE = 'showcase';

// Picsum gives stable, real-looking photos by seed. Replace with curated CDN
// URLs once we have art direction; the seeded images are good enough to make
// a demo feel real without legal/asset overhead.
const img = (sku: string) => `https://picsum.photos/seed/${sku.toLowerCase()}/800/800`;
// Click-through goes to a generic shoppingmate URL since these aren't real
// products on a real store. Adapter is `suggest` — clicking a card on
// shoppingmate.ai isn't expected to add to a real cart anyway.
const url = (sku: string) =>
  `https://shoppingmate.ai/demo/${sku.toLowerCase()}?utm_source=widget_showcase`;

type ShowcaseProduct = {
  sku: string;
  title: string;
  description: string;
  priceCents: number;
  currency: 'USD';
};

const VERTICALS: Record<string, ShowcaseProduct[]> = {
  'dog food': [
    {
      sku: 'DEMO-DOG-001',
      title: 'Wholepack Salmon Recipe Dry Dog Food, 24 lb',
      description:
        'Grain-free dog food with wild-caught salmon as the first ingredient. Supports skin and coat health for adult dogs of all breeds. High-protein, no fillers, dog food bag resealable.',
      priceCents: 6499,
      currency: 'USD',
    },
    {
      sku: 'DEMO-DOG-002',
      title: 'Pasture Lamb & Sweet Potato Dog Food, 15 lb',
      description:
        'Limited-ingredient dog food for sensitive stomachs. Pasture-raised lamb and sweet potato. Grain-free, gentle dog food formula trusted by vets.',
      priceCents: 4999,
      currency: 'USD',
    },
    {
      sku: 'DEMO-DOG-003',
      title: 'Puppy Chicken & Rice Dog Food, 12 lb',
      description:
        'Complete dog food nutrition for puppies up to 12 months. Chicken-first recipe with DHA for brain development. Small-bite kibble dog food.',
      priceCents: 3899,
      currency: 'USD',
    },
    {
      sku: 'DEMO-DOG-004',
      title: 'Senior Beef Stew Wet Dog Food, 12-pack',
      description:
        'Slow-cooked wet dog food for senior dogs. Real beef, carrots, and barley in a rich gravy. Dog food cans with easy-open lids.',
      priceCents: 3299,
      currency: 'USD',
    },
    {
      sku: 'DEMO-DOG-005',
      title: 'Freeze-Dried Raw Beef Dog Food Topper, 14 oz',
      description:
        'Freeze-dried raw dog food topper to boost any kibble. Single-ingredient grass-fed beef. Sprinkle on regular dog food for picky eaters.',
      priceCents: 2899,
      currency: 'USD',
    },
  ],
  apparel: [
    {
      sku: 'DEMO-APP-001',
      title: 'Atelier Linen Camp Shirt, Sand',
      description:
        'Boxy-fit linen camp shirt in stonewashed sand. Open weave linen apparel that breathes in summer. Mother-of-pearl buttons, unisex apparel sizing XS–XXL.',
      priceCents: 11800,
      currency: 'USD',
    },
    {
      sku: 'DEMO-APP-002',
      title: 'Heavyweight Brushed-Cotton Hoodie, Forest',
      description:
        '500 gsm brushed-cotton hoodie. Drop shoulder, ribbed cuffs. Streetwear apparel staple in deep forest green.',
      priceCents: 14500,
      currency: 'USD',
    },
    {
      sku: 'DEMO-APP-003',
      title: 'Wide-Leg Selvedge Denim Jean, Indigo',
      description:
        '14 oz Japanese selvedge denim, wide-leg cut, raw indigo. Premium apparel that softens with wear. Apparel sizes 26–36 waist.',
      priceCents: 19800,
      currency: 'USD',
    },
    {
      sku: 'DEMO-APP-004',
      title: 'Merino Crew Sweater, Oat',
      description:
        '100% Australian merino wool sweater apparel. Soft, non-itch, mid-weight crew. Layering apparel piece for cool weather.',
      priceCents: 16800,
      currency: 'USD',
    },
    {
      sku: 'DEMO-APP-005',
      title: 'Pleated Wool Trouser, Charcoal',
      description:
        'Italian wool trouser apparel with double pleats and tapered leg. Tailored apparel for office or evening. Half-lined for breathability.',
      priceCents: 22500,
      currency: 'USD',
    },
  ],
  jewelry: [
    {
      sku: 'DEMO-JWL-001',
      title: 'Solid 14k Gold Hoop Earrings, 18mm',
      description:
        'Hand-finished 14k yellow gold hoop earrings. Hollow-tube construction makes lightweight everyday jewelry. Hypoallergenic jewelry for sensitive ears.',
      priceCents: 32500,
      currency: 'USD',
    },
    {
      sku: 'DEMO-JWL-002',
      title: 'Pavé Diamond Tennis Bracelet, 7"',
      description:
        '2-carat lab-grown pavé diamond tennis bracelet jewelry in white gold. F-color VS-clarity stones. Box-clasp closure with safety latch.',
      priceCents: 189000,
      currency: 'USD',
    },
    {
      sku: 'DEMO-JWL-003',
      title: 'Brushed Silver Cuff, Wide',
      description:
        'Sterling silver cuff jewelry, hand-hammered with brushed matte finish. Adjustable wrist sizing. Ethically sourced silver jewelry.',
      priceCents: 14800,
      currency: 'USD',
    },
    {
      sku: 'DEMO-JWL-004',
      title: 'Emerald Solitaire Pendant Necklace',
      description:
        '0.6-carat Colombian emerald in 18k yellow gold solitaire setting jewelry. 18-inch box chain. Heirloom-quality jewelry, GIA-certified.',
      priceCents: 245000,
      currency: 'USD',
    },
    {
      sku: 'DEMO-JWL-005',
      title: 'Stacking Rings Set of Three, Mixed Metal',
      description:
        'Set of three thin stacking rings jewelry — yellow gold, rose gold, sterling silver. 1.2 mm bands. Wear individually or stacked.',
      priceCents: 9800,
      currency: 'USD',
    },
  ],
  electronics: [
    {
      sku: 'DEMO-ELC-001',
      title: 'Aurora Over-Ear ANC Headphones',
      description:
        'Premium over-ear electronics headphones with active noise cancellation. 40-hour battery life. Multi-device Bluetooth pairing. Travel-grade audio electronics.',
      priceCents: 32900,
      currency: 'USD',
    },
    {
      sku: 'DEMO-ELC-002',
      title: 'Compact 4K Webcam with Auto-Framing',
      description:
        'Pro-grade webcam electronics with 4K sensor and AI auto-framing. Studio-quality streaming. USB-C plug-and-play, no driver electronics needed.',
      priceCents: 17900,
      currency: 'USD',
    },
    {
      sku: 'DEMO-ELC-003',
      title: 'Mechanical Keyboard 75%, Hot-Swappable',
      description:
        '75% mechanical keyboard electronics. Tactile-brown switches, gasket-mount, RGB backlight. Hot-swappable keyboard electronics for tinkerers.',
      priceCents: 18900,
      currency: 'USD',
    },
    {
      sku: 'DEMO-ELC-004',
      title: 'Portable SSD 2TB, USB-C 40Gbps',
      description:
        'Pocket-sized 2TB SSD electronics with Thunderbolt 4 / USB-C 40Gbps. 3,000 MB/s sustained write. Aluminum housing, drop-resistant electronics.',
      priceCents: 22900,
      currency: 'USD',
    },
    {
      sku: 'DEMO-ELC-005',
      title: 'Smart LED Desk Lamp with Wireless Charging',
      description:
        'Adjustable LED desk lamp electronics with built-in 15 W wireless charger. Three color temperatures. Touch dimmer and timer in lamp electronics.',
      priceCents: 9900,
      currency: 'USD',
    },
  ],
  supplements: [
    {
      sku: 'DEMO-SUP-001',
      title: 'Daily Multivitamin Capsules, 60-day Supply',
      description:
        'Whole-food multivitamin supplements with B-complex, vitamin D3, K2, and chelated minerals. Two capsules daily. Third-party tested supplements.',
      priceCents: 3499,
      currency: 'USD',
    },
    {
      sku: 'DEMO-SUP-002',
      title: 'Magnesium Glycinate Sleep Supplement, 90 ct',
      description:
        '400 mg magnesium glycinate supplements for relaxation and sleep support. Highly absorbable form. Vegan, non-GMO supplements, no fillers.',
      priceCents: 2499,
      currency: 'USD',
    },
    {
      sku: 'DEMO-SUP-003',
      title: 'Omega-3 Fish Oil Softgels, 1500 mg EPA+DHA',
      description:
        'Triglyceride-form omega-3 fish oil supplements with 1,500 mg combined EPA and DHA per serving. Wild-caught, sustainably sourced supplements.',
      priceCents: 3299,
      currency: 'USD',
    },
    {
      sku: 'DEMO-SUP-004',
      title: 'Plant Protein Powder, Vanilla, 2 lb',
      description:
        '25 g plant-based protein supplements per scoop from pea, rice, and pumpkin. No added sugar. Vanilla flavor, mixes clean. Recovery supplements for athletes.',
      priceCents: 4499,
      currency: 'USD',
    },
    {
      sku: 'DEMO-SUP-005',
      title: 'Greens Powder Daily Wellness Blend, 30 servings',
      description:
        'Green-superfood powder supplements with spirulina, chlorella, ashwagandha, probiotics, and digestive enzymes. One scoop daily wellness supplements.',
      priceCents: 5999,
      currency: 'USD',
    },
  ],
};

async function main() {
  // Wipe existing showcase rows so re-runs reflect catalog edits.
  const deleted = await db
    .delete(schema.products)
    .where(and(eq(schema.products.merchantId, MERCHANT_ID), eq(schema.products.source, SOURCE)));
  console.log(`cleared existing showcase rows for ${MERCHANT_ID}`);

  const rows = Object.entries(VERTICALS).flatMap(([vertical, items]) =>
    items.map((p) => ({
      merchantId: MERCHANT_ID,
      sku: p.sku,
      title: p.title,
      description: p.description,
      imageUrl: img(p.sku),
      productUrl: url(p.sku),
      variants: null,
      priceCents: p.priceCents,
      currency: p.currency,
      inStock: true,
      source: SOURCE,
      sourceMeta: { vertical },
    })),
  );

  if (rows.length > 0) {
    await db.insert(schema.products).values(rows);
  }

  console.log(
    `seeded ${rows.length} showcase products across ${Object.keys(VERTICALS).length} verticals for ${MERCHANT_ID}`,
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
