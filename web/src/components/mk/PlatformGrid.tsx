import { Check } from 'lucide-react';
import { Container, Reveal } from './ui';

// Honest per-platform notes: how you install and what Olivia does there.
const PLATFORMS = [
  { name: 'Shopify', install: 'Paste the line into your theme, or add it from the theme editor.', does: ['Real cart & discount codes', 'Your Shopify checkout'] },
  { name: 'WooCommerce', install: 'Paste the line in your theme footer or a header-scripts plugin.', does: ['Real cart & coupons', 'Your WooCommerce checkout'] },
  { name: 'BigCommerce', install: 'Add it under Script Manager — footer, all pages.', does: ['Cart help', 'Your checkout'] },
  { name: 'Wix', install: 'Settings → Custom code → add to all pages (body end).', does: ['Product help & navigation', 'Requests to your inbox'] },
  { name: 'Squarespace', install: 'Settings → Advanced → Code injection → Footer.', does: ['Product help & navigation', 'Requests to your inbox'] },
  { name: 'Magento', install: 'Content → Design → Configuration → Footer scripts.', does: ['Cart help', 'Your checkout'] },
  { name: 'Custom-built sites', install: 'Paste the line before </body> — any framework.', does: ['Works the page like a shopper', 'Bookings, quotes & requests'] },
  { name: 'Service businesses', install: 'Clinics, salons, restaurants — same one line.', does: ['Booking & quote requests', 'Team confirms, never auto-booked'] },
];

export function MkPlatformGrid() {
  return (
    <section className="pb-20 sm:pb-28">
      <Container>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORMS.map((p, i) => (
            <Reveal key={p.name} delay={(i % 4) * 70}>
              <div className="flex h-full flex-col rounded-[22px] border border-[#ececf2] bg-white p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[var(--mk-panel-shadow)]">
                <p className="text-[22px] font-semibold tracking-[-0.03em] text-[#0b0b10]">{p.name}</p>
                <p className="mt-2 flex-1 text-[14.5px] leading-[1.55] text-[#4a4a55]">{p.install}</p>
                <ul className="mt-4 flex flex-col gap-2 border-t border-[#f0f0f4] pt-4">
                  {p.does.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-[14px] text-[#0b0b10]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--mk-accent)]" /> {d}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
