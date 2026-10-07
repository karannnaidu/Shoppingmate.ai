// The help guide the brand support assistant answers from. Keep it TRUE to the
// product — every path here exists in the dashboard. Update it when UI moves.

export const SUPPORT_GUIDE = `
SHOPPINGMATE — HELP GUIDE FOR STORE OWNERS

WHAT IT IS
shoppingmate puts an assistant (voice + chat) on the owner's website. It greets shoppers, answers from the store's products, pages and documents, adds to cart, applies codes, fills checkout on supported stores, takes customer requests (complaints, returns, order tracking, bookings, quotes) and shows every conversation in the dashboard. For restaurants, salons, clinics and other service businesses it answers from the website and takes booking / callback requests instead of selling products.

INSTALL / "THE ASSISTANT ISN'T SHOWING ON MY SITE"
- The line to paste is in Settings → "Your line". Paste it into the site's header. Shopify: Online Store → Themes → … → Edit code → theme.liquid, paste just before </head>, Save. WordPress/WooCommerce: a header-scripts plugin or the theme header. Other builders: their "custom code / header" setting.
- Press "Check my site" in Settings → Your line to confirm it is detected. "Last seen on your site" shows when it last loaded.
- If the store opens on more than one address (own domain + .myshopify.com, or www and without www), every address must be listed in Settings → "Your web addresses", otherwise the assistant won't load there.
- If the theme was changed or updated, the line may have been removed — paste it again.
- The launcher hides itself while a cart drawer or popup covers that corner, and comes back when it closes.

PRODUCTS / "IT DOESN'T KNOW MY PRODUCTS OR PRICES"
- Products are read automatically from the store (Shopify and WooCommerce catalogs; other sites from their product pages). The chip on Home shows how many products are loaded.
- If prices/stock look out of date, ask the support assistant to file a "setup" request; the team can re-sync.

"YOUR WEBSITE IS BLOCKING OUR PAGE READER" (setupProblem starts with site_blocks_reader)
- The site's bot protection (often Cloudflare) refused our reader. The assistant still works on the site, but can't learn its pages. Fix: in Cloudflare → Security → Bots (or your host's firewall), allow the user agent "ShoppingmateBot", then press "Re-read my pages" on Your website. Or upload FAQs, menus and price lists in Knowledge.

PAGES, POLICIES AND FAQ
- "Your website" shows the pages the assistant has read (shipping, returns, FAQ, contact, menu, services…). Press "Re-read my pages" after changing the site.
- For anything not on the site (detailed FAQs, size guides, ingredient sheets, menus, price lists), upload documents in Knowledge (PDF, Word, Markdown or text, up to 4 MB). The assistant uses them within minutes.

HOW IT SOUNDS AND LOOKS
- Settings → Persona: voice, brand voice notes ("speak warmly, never use exclamation marks…") and tone (formal ↔ playful).
- Settings → Widget appearance: where the button sits, its size, brand colour, button text and greeting.

CUSTOMER REQUESTS AND LEADS
- When a shopper needs the team (late order, damaged item, return, complaint, a question the assistant couldn't answer, a booking, a quote), the assistant takes their name and phone/email and it appears in Customer requests and in the owner's email. Mark each one handled when done.
- Settings → Leads webhook sends each new lead to another tool (e.g. a CRM).

CONVERSATIONS, ORDERS, REVENUE
- Conversations: every chat and call; open one to see what was said and what really happened on the site. Transcripts are deleted after 24 hours.
- Orders / Revenue: orders from shoppers who talked to the assistant.

INSIGHTS (Growth and Scale plans)
- Where shoppers stop, what they tap, a weekly list of fixes by email. Scale adds shopper journeys and CSV export.

BILLING
- Plans: Starter $30 (100 conversations/month), Growth $99 (350 + Store Insights), Scale $299 (1,000 + journeys and export). One conversation = one shopper visit, voice or chat.
- Top up anytime in Billing at $0.30 per conversation (packs of 100/500/1,000); top-ups don't expire.
- To change plan: cancel in Billing, then start the new plan. Cancelling takes effect at the end of the billing period.

LANGUAGES AND VOICE
- Shoppers can talk in their own language; the assistant replies in the same one. Voice needs microphone permission in the shopper's browser.

PRIVACY
- shoppingmate never sees card details; shoppers pay on the store's own checkout. Conversations auto-delete after 24 hours.
`;
