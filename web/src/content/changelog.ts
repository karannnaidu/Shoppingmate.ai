// Public changelog for www.shoppingmate.shop/changelog.
//
// RULE (see CLAUDE.md): every push to main that changes what brands or shoppers
// get adds an entry at the TOP of this list in the same commit. Write for store
// owners — outcomes, not module names. Newest first. `commits` lists the short
// hashes the entry covers, so `scripts/changelog-draft.mjs` knows what's logged.

export type ChangeKind = 'new' | 'improved' | 'fixed';

export type Release = {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Short release name owners will recognise. */
  title: string;
  /** One or two sentences: what this means for a store. */
  summary: string;
  changes: { kind: ChangeKind; text: string }[];
  commits: string[];
};

export const RELEASES: Release[] = [
  {
    date: '2026-10-31',
    title: 'A new shoppingmate.shop — and Olivia one tap away',
    summary:
      'The website was rebuilt around what Olivia actually does for a store, with the live assistant one tap from every page and a public changelog.',
    changes: [
      { kind: 'new', text: 'Redesigned website: real product screens instead of illustrations, and the same polish and motion on phones as on desktop.' },
      { kind: 'new', text: '"Talk to Olivia now" starts a real voice call from any button. Brands can add the same button to their own site with one line of code.' },
      { kind: 'new', text: 'Every section has its own page again — Features, How it works, Platforms, Pricing, FAQ — plus this changelog.' },
      { kind: 'improved', text: 'Pricing now reads "Cart, discount-code and checkout help" — Olivia applies your codes; she never invents one.' },
      { kind: 'fixed', text: 'The photo button no longer appears on our own demo call.' },
    ],
    commits: ['cc28b02', 'c7a5712', '67f1dec', 'a0d4ba5'],
  },
  {
    date: '2026-10-29',
    title: 'Customer requests for every kind of business',
    summary:
      'Bookings, meeting requests, enquiries and feedback now reach your team reliably — by chat or voice, in any industry — on the new shoppingmate.shop domain.',
    changes: [
      { kind: 'new', text: 'We moved to shoppingmate.shop. Sign-in emails now come from login@shoppingmate.shop and customer emails from "<Your brand> Care".' },
      { kind: 'new', text: 'Password sign-in for review and demo accounts we set up (brand owners keep using email links).' },
      { kind: 'improved', text: 'Meeting requests, enquiries, bookings and feedback work for every business type, and a request is never logged twice.' },
      { kind: 'improved', text: 'On calls Olivia waits for the real result and gives the request number — she never says "booked" before it is.' },
      { kind: 'improved', text: 'Feedback is saved the moment a shopper shares it, and email addresses are spelled back on calls.' },
      { kind: 'improved', text: 'Your team is always notified: if a store has no support email yet, the request goes to our support team instead.' },
      { kind: 'fixed', text: 'Opening a sign-in link twice no longer shows an error — you go straight to your dashboard.' },
      { kind: 'fixed', text: 'Old shoppingmate-web.vercel.app links now open the same page on www.shoppingmate.shop, so you stay signed in.' },
    ],
    commits: ['2a578e7', 'c91c185', '975c1a9', 'fce27d7', '8748d09', 'c8ec512', '312b358', 'd181d3e', '81bd072', '8c517da', '8eb06e2', '31998ba', 'a52aa7c'],
  },
  {
    date: '2026-10-28',
    title: 'Customer care: complaints, returns and photo proof',
    summary:
      'Olivia now handles the after-sale conversations too — and hands every one to your team with the details already filled in.',
    changes: [
      { kind: 'new', text: 'Shoppers can raise complaints, returns, cancellation requests and feedback with their order number — returns and cancellations stay requests your team approves.' },
      { kind: 'new', text: 'Photo proof: shoppers add up to three photos of a damaged or wrong item from the chat or a call. Photos are private to your team and deleted after 180 days.' },
      { kind: 'new', text: 'Shoppers get a confirmation email with their request number; reply to them straight from the dashboard.' },
      { kind: 'improved', text: 'Voice calls wait for shoppers to finish speaking, hear quiet microphones and keep one consistent conversation.' },
      { kind: 'fixed', text: 'Background noise at the start of a call no longer interrupts Olivia.' },
    ],
    commits: ['01e387e', 'b98fe87', 'ce49894', 'c53f2d7', '3c5736f', 'f30fbec', '39b2b91'],
  },
  {
    date: '2026-10-27',
    title: 'Steadier voice calls',
    summary: 'A round of reliability fixes for calls and captions.',
    changes: [
      { kind: 'fixed', text: 'A simple "hello" is always answered in English.' },
      { kind: 'fixed', text: 'Leaving the page ends the call and releases the microphone.' },
      { kind: 'fixed', text: 'Product cards in the middle of a reply no longer duplicate the caption.' },
      { kind: 'improved', text: 'If one AI provider has a problem, Olivia switches to a backup automatically.' },
    ],
    commits: ['264e1ad', '3aea9aa', '620c5e2', 'a440107', 'aa63c26'],
  },
  {
    date: '2026-10-13',
    title: 'Instant voice',
    summary: 'Our own voice connection: Olivia now starts speaking about a second after a shopper taps Call.',
    changes: [
      { kind: 'new', text: 'A faster voice connection built for shopping calls — from tap to first word in about a second.' },
      { kind: 'improved', text: 'Returning shoppers hear their greeting instantly, and can interrupt it.' },
      { kind: 'improved', text: 'Clearer audio with built-in noise reduction, and Olivia no longer cuts in while a shopper is still talking.' },
      { kind: 'fixed', text: 'Consultations are confirmed only once they are really booked.' },
    ],
    commits: ['f086c2d', 'c3f5af7', '69b0870', '267d88b', '7b57f7e', '3829a9b', '89f799c', '4881d6d', '14a2280', '468a8b2'],
  },
  {
    date: '2026-10-08',
    title: 'Built for every kind of business',
    summary: 'Clinics, salons, restaurants and service firms now get an assistant — and a dashboard — designed around bookings.',
    changes: [
      { kind: 'new', text: 'Service businesses: Olivia takes booking and quote requests, and the dashboard leads with bookings.' },
      { kind: 'new', text: 'Choose your business type in Settings to tune how Olivia sells and what she asks.' },
      { kind: 'new', text: 'A support assistant inside the dashboard, with tickets to our team.' },
      { kind: 'improved', text: 'Stores protected against bots can now go live, and store policies are kept even if a crawl fails.' },
      { kind: 'new', text: 'A chat shortcut beside the Call button on every widget.' },
      { kind: 'fixed', text: 'Service sites without a product catalog no longer get product suggestions, and closed accounts stop showing the assistant.' },
      { kind: 'fixed', text: 'Store Insights shows one row per product with realistic money and a working "Show me on the page".' },
    ],
    commits: ['65b314e', '5b2e940', '85b015d', '7ad93f8', 'eea7d98', 'fe2ff14', '13558eb', 'ec3ffd5', '4084d22', 'f6ef484', '8dfff30', 'c2ae2f9', 'dc6dcc9', '6b43128', 'bfbf07e', 'a63ef07', 'bf6fdf4', '90f8de7'],
  },
  {
    date: '2026-10-07',
    title: 'shoppingmate 2.0',
    summary: 'A new look for the website and the owner dashboard, and every plan now delivers exactly what pricing promises.',
    changes: [
      { kind: 'new', text: 'Redesigned owner dashboard that leads with the answer: what sold, who needs you and the fix worth making.' },
      { kind: 'fixed', text: 'Plan features and limits now match the pricing page.' },
      { kind: 'improved', text: 'Scale plan journeys show each shopper’s real route through your store.' },
      { kind: 'improved', text: 'Olivia keeps answering when one AI provider is busy, switching to a backup automatically.' },
    ],
    commits: ['10765b1', 'cde0181', '6ed831e', '8e231c9', '78415a0'],
  },
  {
    date: '2026-10-06',
    title: 'Store Insights',
    summary: 'See where shoppers get stuck and why they leave — with a short weekly list of fixes. Included on Growth and Scale.',
    changes: [
      { kind: 'new', text: 'Store Insights: tap heatmaps by page type, drop-off steps and a weekly list of fixes in plain English.' },
      { kind: 'new', text: 'An email when your store’s sales drop sharply, so you hear about it the same day.' },
      { kind: 'new', text: 'Shopper receipts and an owner timeline showing exactly what Olivia did on your site.' },
      { kind: 'new', text: 'Nightly automatic checks of your store on Chrome and Safari, desktop and mobile.' },
      { kind: 'new', text: 'Olivia can see and use your pages — choosing sizes, opening tabs and sections — and only shows a tick once your page confirms it worked.' },
      { kind: 'new', text: 'Customer requests inbox: order tracking, complaints, returns and callbacks captured from conversations and emailed to your team.' },
      { kind: 'new', text: 'Live cart and stock checks on Shopify, WooCommerce and other platforms.' },
      { kind: 'new', text: 'Olivia adapts to each visitor — quick answers for shoppers in a hurry, and no upselling to an unhappy customer.' },
      { kind: 'improved', text: 'Redesigns are noticed automatically; you can also re-scan your site from the dashboard.' },
      { kind: 'fixed', text: 'Olivia no longer forgets the previous message in a long chat, and never ends a turn in silence.' },
      { kind: 'fixed', text: 'Store Insights counts real visits across pages, labels products by name and ignores background animations.' },
      { kind: 'improved', text: 'Better contrast and clearer button feedback across the dashboard, plus a new logo.' },
    ],
    commits: ['c848a86', 'ea59747', 'f128d08', '1c8fa95', 'c52575d', '3a905a3', '97e6ce1', '6d0ea6d', '57c3852', '83d6a36', '74bbabe', 'd8739dd', 'd02db37', '794634e', 'c3d6650', '7561f13', 'bd3f140', '29a4e6c', 'e2628f4', '19bb8c6', '3901397', 'e0f6d17', '770d024', 'ba9334b', '98e4547', '72c5ee8', 'dbbbbeb', '6aa5da6', '1f34fef', 'c8c2055', '3977ea1', 'dbc6f33', '17b1eb0', '8d6fe39', '9ed1eb5', '2badd6f', '2848572', '731bfeb'],
  },
  {
    date: '2026-10-05',
    title: 'Simple, credit-based billing',
    summary: 'Plans now count conversations — one shopper visit is one credit, voice or chat — with top-up packs whenever you need more.',
    changes: [
      { kind: 'new', text: 'A redesigned Billing page: your plan, credits used this month and one-tap top-ups.' },
      { kind: 'new', text: 'Pay securely with Razorpay — see your invoices and cancel any time from Billing.' },
      { kind: 'new', text: 'A clear privacy policy explaining exactly what data is used and for how long.' },
      { kind: 'fixed', text: 'Dashboard home loads reliably, and copy across the dashboard is clearer.' },
    ],
    commits: ['f59459a', 'd8733c8', '7b7b9af', '1e9539e', '4060275', '20c1de2', 'b8b9280', 'be975d3'],
  },
];
