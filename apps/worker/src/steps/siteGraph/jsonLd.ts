export type LdProduct = {
  sku: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  currency: string | null;
  inStock: boolean | null;
  brand: string | null;
  raw: Record<string, unknown>;
};

export type LdFaq = { question: string; answer: string };

export type JsonLdHarvest = {
  product: LdProduct | null;
  faqs: LdFaq[];
};

const SCRIPT_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export function harvestJsonLd(html: string, url: string): JsonLdHarvest {
  const blocks: unknown[] = [];
  for (const m of html.matchAll(SCRIPT_RE)) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    try { blocks.push(JSON.parse(raw)); } catch { /* skip malformed */ }
  }

  const items: Record<string, unknown>[] = [];
  for (const b of blocks) flatten(b, items);

  const productNode = items.find(
    (n) => stringType(n['@type']) === 'product',
  );
  const faqNode = items.find((n) => stringType(n['@type']) === 'faqpage');

  return {
    product: productNode ? toProduct(productNode, url) : null,
    faqs: faqNode ? toFaqs(faqNode) : [],
  };
}

function flatten(node: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(node)) { for (const x of node) flatten(x, out); return; }
  if (!isObj(node)) return;
  out.push(node);
  const graph = node['@graph'];
  if (Array.isArray(graph)) for (const x of graph) flatten(x, out);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function stringType(t: unknown): string {
  if (typeof t === 'string') return t.toLowerCase();
  if (Array.isArray(t)) return t.map((x) => (typeof x === 'string' ? x : '')).join(',').toLowerCase();
  return '';
}

function pickString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    const first = v.find((x) => typeof x === 'string');
    return typeof first === 'string' ? first : null;
  }
  if (isObj(v)) {
    if (typeof v.url === 'string') return v.url;
    if (typeof v.name === 'string') return v.name;
    if (typeof v['@id'] === 'string') return v['@id'];
  }
  return null;
}

function toProduct(node: Record<string, unknown>, url: string): LdProduct {
  const name = pickString(node.name) ?? 'Untitled product';
  const description = pickString(node.description);
  const image = pickString(node.image);
  const brand = pickString(node.brand);
  const sku = (typeof node.sku === 'string' ? node.sku : null) ?? slugFromUrl(url) ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const offer = pickOffer(node.offers);
  return {
    sku,
    title: name,
    description,
    imageUrl: image,
    priceCents: offer.priceCents,
    currency: offer.currency,
    inStock: offer.inStock,
    brand,
    raw: node,
  };
}

function pickOffer(v: unknown): { priceCents: number | null; currency: string | null; inStock: boolean | null } {
  const node = Array.isArray(v) ? v.find(isObj) : isObj(v) ? v : null;
  if (!node) return { priceCents: null, currency: null, inStock: null };
  const priceRaw = node.price ?? node.lowPrice;
  let priceCents: number | null = null;
  if (typeof priceRaw === 'number') priceCents = Math.round(priceRaw * 100);
  else if (typeof priceRaw === 'string' && priceRaw.trim()) {
    const n = Number(priceRaw.replace(/[^\d.]/g, ''));
    if (Number.isFinite(n)) priceCents = Math.round(n * 100);
  }
  const currency = typeof node.priceCurrency === 'string' ? node.priceCurrency : null;
  const avail = typeof node.availability === 'string' ? node.availability.toLowerCase() : null;
  const inStock = avail ? avail.includes('instock') : null;
  return { priceCents, currency, inStock };
}

function toFaqs(node: Record<string, unknown>): LdFaq[] {
  const entity = node.mainEntity;
  const list = Array.isArray(entity) ? entity : entity ? [entity] : [];
  const out: LdFaq[] = [];
  for (const item of list) {
    if (!isObj(item)) continue;
    const q = pickString(item.name);
    const a = pickString(isObj(item.acceptedAnswer) ? item.acceptedAnswer.text : item.acceptedAnswer);
    if (q && a) out.push({ question: q, answer: a });
  }
  return out;
}

const SHOP_SLUG_RE = /\/(shop|products|product|store|p)\/([^/?#]+)/i;

export function slugFromUrl(url: string): string | null {
  try {
    const m = new URL(url).pathname.match(SHOP_SLUG_RE);
    return m?.[2] ?? null;
  } catch { return null; }
}

export function looksLikePdpUrl(url: string): boolean {
  return slugFromUrl(url) !== null;
}
