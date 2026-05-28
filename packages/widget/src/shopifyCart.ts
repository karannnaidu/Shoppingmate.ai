export async function injectShopifyCartAttribute(args: {
  visitorId: string;
  platform: string;
  fetchFn?: typeof fetch;
}): Promise<void> {
  if (args.platform !== 'shopify') return;
  const fetchFn = args.fetchFn ?? fetch;
  try {
    await fetchFn('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes: { sm_visitor_id: args.visitorId } }),
    });
  } catch {
    /* best-effort */
  }
}
