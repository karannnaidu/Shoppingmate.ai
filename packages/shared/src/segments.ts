// D2C segment playbooks (multi-segment PRD 2026-10-07). Every brand except the
// hand-built Calmosis path used to get the same generic selling guidance, so a
// sofa store, a lipstick store and a vitamins store were sold the same way. The
// segment is derived from the brand profile onboarding already writes
// (brand_summary + brand_categories) — no setup for the merchant.

export type Segment =
  // Service businesses — the goal is a booking or enquiry, not a cart.
  | 'clinic'
  | 'restaurant'
  | 'salon'
  | 'services'
  // Product (D2C) brands.
  | 'fashion'
  | 'beauty'
  | 'jewelry'
  | 'home'
  | 'supplements'
  | 'pet'
  | 'food'
  | 'electronics'
  | 'sports'
  | 'general';

// Ordered: the first segment with the most keyword hits wins; ties go to the
// earlier (more specific / higher-risk) entry, e.g. supplements before food.
const KEYWORDS: Array<[Segment, RegExp]> = [
  // Highest-risk first: a clinic must never be treated as a product store.
  ['clinic', /\b(clinic|doctors?|dental|dentist|orthodont|physician|hospital|medical cent(er|re)|healthcare|physio(therapy)?|dermatolog|pediatric|paediatric|gyn(a)?ecolog|cardiolog|eye care|optometr|patients?|consultations?|appointments?)/gi],
  ['restaurant', /\b(restaurants?|menu|reservations?|book a table|table booking|cafe|café|bistro|eatery|cuisine|brunch|lunch|dinner|takeaway|take-away|dine-in|chef|pizzeria|bakery)\b/gi],
  ['salon', /\b(salons?|spa|haircuts?|barbers?|blow ?dry|nail salon|manicure|pedicure|massages?|facials?|waxing|lash(es)? extensions?|stylists?|hair colou?r(ing)?|bridal makeup)\b/gi],
  ['supplements', /\b(vitamin|supplement|multivitamin|probiotic|protein powder|collagen|gut health|prenatal|pregnan|nutrient|capsule|gumm(y|ies)|wellness|immun)/gi],
  ['beauty', /\b(makeup|cosmetic|lipstick|lip (gloss|products?)|eyeshadow|mascara|foundation|concealer|blush|skin ?care|serum|moisturi[sz]er|fragrance|perfume|nail|hair ?care|shampoo|beauty)/gi],
  ['jewelry', /\b(jewel+e?ry|necklace|earring|ring|bracelet|pendant|charm|anklet|gold|silver|diamond|pearl)/gi],
  ['pet', /\b(pet|dog|cat|puppy|kitten|leash|harness|collar|litter|treats?)\b/gi],
  ['home', /\b(sofa|sectional|couch|furniture|rug|mattress|bed(ding|room)?|pillow|sheet|towel|dining|chair|table|lamp|lighting|decor|kitchen|cookware|outdoor furniture|home)/gi],
  ['food', /\b(food|snack|soda|drink|beverage|coffee|tea|sauce|chocolate|candy|olive oil|spice|grocery|meal|flavou?r)/gi],
  ['electronics', /\b(electronic|headphone|earbud|speaker|charger|cable|phone case|laptop|camera|gadget|smart)/gi],
  ['sports', /\b(snowboard|ski|bike|cycling|yoga|fitness|gym|running gear|surf|golf|camping|outdoor gear)/gi],
  ['fashion', /\b(apparel|clothing|shoes?|sneakers?|boots?|sandals?|dress(es)?|shirts?|tees?|jeans|pants|jackets?|hoodies?|socks|underwear|activewear|fashion|wear|bags?|handbags?)/gi],
  ['services', /\b(services?|consult(ing|ancy)|agency|repairs?|cleaning|plumb(ing|er)|electrician|tutoring|coaching|classes|courses|studio|gym|real estate|insurance|legal|lawyers?|accounting|photography|events?|wedding planner|interior design|quote)\b/gi],
];

/** Service businesses sell time/visits, not shippable products. */
export const SERVICE_SEGMENTS: ReadonlySet<Segment> = new Set(['clinic', 'restaurant', 'salon', 'services']);

// Used only when there is no brand profile (e.g. the site blocks our reader):
// service words matched inside the name/domain, so "clovedental.in" is still
// treated as a clinic and gets its safety rules. Compound-safe words only.
const NAME_HINTS: Array<[Segment, RegExp]> = [
  ['clinic', /(dental|dentist|clinic|hospital|healthcare|medical|derma|ortho|physio|pediatric|paediatric|eyecare|optometr|doctor)/i],
  ['restaurant', /(restaurant|bistro|pizzeria|pizza|burger|eatery|diner|brasserie|trattoria|cafe|café|kitchen|grill)/i],
  ['salon', /(salon|barber|hairdress|nailbar|nailstudio|beautyparlou?r|dayspa)/i],
];

export function detectSegment(brand: {
  brandSummary?: string | null;
  brandCategories?: string[] | null;
  name?: string | null;
  domain?: string | null;
  /** Owner's choice in Settings — wins over detection when valid. */
  businessType?: string | null;
}): Segment {
  if (brand.businessType && brand.businessType in SEGMENT_PLAYBOOK) return brand.businessType as Segment;
  if (!(brand.brandCategories ?? []).length && !brand.brandSummary?.trim()) {
    const hint = `${brand.name ?? ''} ${brand.domain ?? ''}`;
    for (const [seg, rx] of NAME_HINTS) if (rx.test(hint)) return seg;
    return 'general';
  }
  // Categories are the strongest signal; count them twice.
  const cats = (brand.brandCategories ?? []).join(' . ');
  const text = `${cats} . ${cats} . ${brand.brandSummary ?? ''}`;
  let best: Segment = 'general';
  let bestHits = 0;
  for (const [seg, rx] of KEYWORDS) {
    const hits = text.match(rx)?.length ?? 0;
    if (hits > bestHits) {
      best = seg;
      bestHits = hits;
    }
  }
  return bestHits >= 2 ? best : 'general';
}

// Eval 2026-10-08: shops asked "men or women?" twice and never showed a shoe.
const DISCOVERY = `SHOW, THEN ASK: when a shopper says what they want, call products.search in that same turn and show 2–4 good matches together with at most ONE short question to narrow them (e.g. "these run wide — men's or women's?"). Never reply to a shopping request with only questions, and never go two replies in a row without showing products. If they already gave a detail (size, budget, skin type), use it — don't ask again.`;

const GROUNDING = `PRODUCT FACTS COME FROM THE PRODUCT, NOT FROM YOU: before answering a question about a specific product's size or fit, materials, ingredients, dimensions, compatibility, care, nutrition or what's in the box, call products.get (or products.search) and answer ONLY from its description and options. If the answer isn't there, say so plainly ("the product page doesn't say") and offer to pass the question to the team (case.open, type product_question) — never fill the gap with a guess.`;

// Service businesses: the conversion is a booking or enquiry captured with
// case.open (type booking / quote), or a hand-off to their own booking page.
const BOOKING = `THE GOAL HERE IS A BOOKING OR ENQUIRY, NOT A CART. If the site has its own booking/reservation/ordering page or partner (e.g. a "Book now" page, OpenTable, Fresha, Practo, Zomato/Swiggy/Uber Eats), take them there (site.navigate) and say so. Otherwise collect what the business needs — name, phone, preferred date and time, and the details below — confirm consent to be contacted, then call case.open with type "booking" (or "quote" for a price/estimate request). NEVER say a booking is confirmed — say the team will confirm by phone/message. Answer hours, address, prices and services ONLY from the site; if they aren't there, say so.`;

export const SEGMENT_PLAYBOOK: Record<Segment, { label: string; text: string }> = {
  clinic: {
    label: 'Clinic / doctor',
    text: `You are NOT a doctor and must NEVER diagnose, interpret symptoms, suggest treatments or medicines, or say whether something is serious. If anything sounds urgent (chest pain, trouble breathing, heavy bleeding, thoughts of self-harm, a child who is very unwell), tell them to call their local emergency number or go to the nearest emergency department NOW, before anything else. Help with: which doctor/department, timings, fees, location, insurance accepted, and appointment requests. For an appointment collect only name, phone, preferred date/time, which doctor or department, and the reason in a few general words — never ask for detailed medical history. ${BOOKING}`,
  },
  restaurant: {
    label: 'Restaurant / café',
    text: `Help with the menu, timings, location, parking, dietary needs and reservations. Quote dishes, prices, allergens and spice levels only from the menu on the site; for severe allergies say to confirm with the staff when ordering. For a table collect name, phone, date, time and number of guests (and any occasion or seating preference). For delivery/takeaway point them to the ordering link on the site. ${BOOKING}`,
  },
  salon: {
    label: 'Salon / spa',
    text: `Help them choose a service (cut, colour, nails, spa, bridal…), explain what it includes, duration and price from the site's service list, and book. For a booking collect the service, preferred stylist/therapist if any, date and time, name and phone. Mention patch tests for colour/lash services if the site requires them; don't promise results for hair/skin conditions. ${BOOKING}`,
  },
  services: {
    label: 'Service business',
    text: `Understand what they need (what, where, when, how big), explain the relevant service and pricing ONLY as the site states it, and capture a quote or callback request with those details plus name and phone. Don't promise availability, timelines or exact prices the site doesn't state. ${BOOKING}`,
  },
  fashion: {
    label: 'Fashion & footwear',
    text: `Ask who it's for (men's/women's/kids) and their usual size before recommending a size. Use the product's own sizing notes (true to size, size up/down, wide fit) and its size options — never invent a fit ("runs large", "good for wide feet") the product doesn't state. Mention exchanges for size only if the brand's policy says so. Suggest a complete look only after the main item is chosen.`,
  },
  beauty: {
    label: 'Beauty & personal care',
    text: `Ask skin type, skin tone/undertone and any sensitivities before recommending a shade or formula. For allergies or sensitive skin, read the product's ingredients and quote them; never promise "hypoallergenic", "safe for everyone" or medical results, and suggest a patch test. Don't diagnose skin conditions.`,
  },
  jewelry: {
    label: 'Jewelry & accessories',
    text: `Clarify the occasion, budget and the metal they wear. State the exact material from the product (solid gold vs vermeil vs plated, karat, sterling) and what that means for wear and tarnish. Ask ring/chain size when relevant. For gifts, mention gift options only if the store offers them (check the site/policies) and ask if they'd like a note.`,
  },
  home: {
    label: 'Home & furniture',
    text: `Ask about the space before recommending (room, size, doorways/stairs for big pieces). Quote dimensions from the product; for "will it fit", compare to their measurements and say how it's delivered (boxed/modular/white-glove) only if the product or policy says. Mention delivery time, assembly and returns for large items from the brand's policies — never guess delivery dates.`,
  },
  supplements: {
    label: 'Supplements & nutrition',
    text: `You are not a doctor. NEVER say a product cures, treats, prevents or heals anything, and never promise results. For pregnancy, medical conditions, medication interactions or children, give the product's label facts and clearly recommend they check with their doctor or pharmacist before taking it. Quote serving size and ingredients from the product; don't invent dosages.`,
  },
  pet: {
    label: 'Pet',
    text: `Ask the pet's species, breed or size/weight and age before recommending sizes or food. Use the product's sizing chart (neck/chest/weight) — ask for measurements when the chart needs them. For health or diet questions, share the label facts and suggest checking with their vet.`,
  },
  food: {
    label: 'Food & drink',
    text: `Quote nutrition, ingredients, allergens and caffeine from the product label only. For medical diets (diabetes, allergies, pregnancy) share the label facts and say to check with their doctor — never call something "safe for" a condition. Mention flavours/variety packs to help them choose, and shelf life/shipping only if the store states it.`,
  },
  electronics: {
    label: 'Electronics',
    text: `Ask what device or setup it's for and check compatibility in the product's specs before saying it works. Quote specs, what's in the box and warranty from the product/policies only.`,
  },
  sports: {
    label: 'Sports & outdoors',
    text: `Ask skill level, height/weight or size and how they'll use it before recommending (e.g. board length, frame size). Use the product's size charts; never guess sizing or safety ratings.`,
  },
  general: {
    label: 'General retail',
    text: `Show a few likely picks straight away, ask at most one quick question to narrow them, and answer specifics from the product's own details.`,
  },
};

/** Voice variant: the talker can't call tools, so no products.get rule — it
 *  must say when a detail isn't known instead of guessing. */
export function segmentVoiceRule(brand: Parameters<typeof detectSegment>[0]): string {
  const seg = detectSegment(brand);
  const p = SEGMENT_PLAYBOOK[seg];
  if (SERVICE_SEGMENTS.has(seg)) {
    return `HELPING CUSTOMERS OF THIS BUSINESS (${p.label})\n${p.text}\nA separate layer files the booking or enquiry once you have the details — say the team will confirm. If a detail (hours, price, a service, a doctor or dish) isn't in what you've been told, say the website doesn't say and offer a call back from the team — never guess.`;
  }
  return `SELLING IN THIS CATEGORY (${p.label})\n${p.text}\nIf a product detail (size, material, ingredient, dimension, compatibility) isn't in what you've been told, say the product page doesn't say and offer to pass the question to the team — never guess.`;
}

/** The SELLING IN THIS CATEGORY prompt block for a brand. */
export function segmentBlock(brand: Parameters<typeof detectSegment>[0]): string {
  const seg = detectSegment(brand);
  const p = SEGMENT_PLAYBOOK[seg];
  // Services have no product catalog — the grounding rule is about the site.
  const grounding = SERVICE_SEGMENTS.has(seg)
    ? 'FACTS COME FROM THE SITE: hours, prices, services, doctors/staff, menu and policies only as the website states them; if something isn\'t there, say so and offer to have the team call back (case.open).'
    : `${GROUNDING}\n${DISCOVERY}`;
  return `\n${SERVICE_SEGMENTS.has(seg) ? 'HELPING CUSTOMERS OF THIS BUSINESS' : 'SELLING IN THIS CATEGORY'} (${p.label})\n${p.text}\n${grounding}\n`;
}
