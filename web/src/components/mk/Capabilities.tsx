import { CalendarCheck, Camera, Check, CreditCard, Lock, TrendingDown } from 'lucide-react';
import { Carousel, Container, Eyebrow, ExampleTag, H2, Lead, OLIVIA_AVATAR, Reveal } from './ui';
import { cn } from '@/lib/cn';

function Card({ title, body, children, className }: { title: string; body: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-full flex-col overflow-hidden rounded-[26px] border border-[#ececf2] bg-white', className)}>
      <div className="flex-1 bg-[#fbfbfd] p-5 sm:p-6">{children}</div>
      <div className="border-t border-[#f0f0f4] p-5 sm:p-6">
        <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-[#0b0b10]">{title}</h3>
        <p className="mt-1.5 text-[15px] leading-[1.5] text-[#4a4a55]">{body}</p>
      </div>
    </div>
  );
}

function Bubble({ me, children }: { me?: boolean; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        'max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug',
        me ? 'self-end rounded-br-md bg-[#0b0b10] text-white' : 'self-start rounded-bl-md bg-white text-[#0b0b10] shadow-[0_1px_2px_rgba(11,11,16,0.06)]',
      )}
    >
      {children}
    </p>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#ececf2] bg-white px-3 py-2.5">
      <span className="text-[12.5px] text-[#6e6e7a]">{label}</span>
      <span className="flex items-center gap-1.5 text-[13.5px] font-medium text-[#0b0b10]">
        {value} <Check className="h-3.5 w-3.5 text-[#16a34a]" />
      </span>
    </div>
  );
}

export function MkCapabilities() {
  return (
    <section id="what" className="scroll-mt-24 py-16 sm:py-32">
      <Container>
        <Reveal className="max-w-[760px]">
          <Eyebrow>What she does</Eyebrow>
          <H2>Everything a great shop assistant does. On every page, all night.</H2>
          <Lead className="mt-5 max-w-[600px]">Not a chat box that says &ldquo;let me connect you to an agent.&rdquo; Olivia actually helps — and shows a tick only when your page confirms it worked.</Lead>
        </Reveal>

        <Reveal className="mt-14">
          <Carousel
            label="What Olivia does"
            desktopClass="lg:grid lg:grid-cols-6 lg:gap-4"
            spans={["lg:col-span-4", "lg:col-span-2", "lg:col-span-2", "lg:col-span-2", "lg:col-span-2"]}
          >
            {[
            <Card key="Talks and types — in their language" title="Talks and types — in their language" body="Shoppers tap Call and talk, or type. She answers in English, Hindi, Spanish and more, in your brand's tone.">
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={OLIVIA_AVATAR} alt="" className="h-8 w-8 rounded-full object-cover" />
                <p className="text-[13px] font-medium text-[#0b0b10]">Olivia · voice call</p>
                <ExampleTag className="ml-auto" />
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Bubble me>Kya yeh dry skin ke liye theek hai?</Bubble>
                <Bubble>Haan, bilkul — yeh fragrance-free hai aur dry skin ke liye hi bana hai. 50 ml se shuru karein?</Bubble>
                <Bubble me>Haan, cart mein daal do.</Bubble>
              </div>
            </Card>,
            <Card key="Fills in checkout" title="Fills in checkout" body="Adds to cart, applies your real codes and fills in their details. They just tap pay.">
              <div className="flex flex-col gap-2">
                <Field label="Name" value="Asha Rao" />
                <Field label="Phone" value="•••• 3210" />
                <Field label="Pincode" value="560038" />
                <div className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-[#0b0b10] py-2.5 text-[13.5px] font-medium text-white">
                  <CreditCard className="h-4 w-4" /> Pay on your checkout
                </div>
              </div>
            </Card>,
            <Card key="Takes complaints, with photo proof" title="Takes complaints, with photo proof" body="Damaged parcel? She logs the order number, takes a photo and emails your team.">
              <div className="rounded-2xl border border-[#ececf2] bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#fff1e6] px-2 py-0.5 text-[11.5px] font-medium text-[#c2410c]">Complaint</span>
                  <span className="text-[12px] text-[#6e6e7a]">Request #52</span>
                </div>
                <p className="mt-2.5 text-[14px] font-medium leading-snug text-[#0b0b10]">Order 34789 arrived leaking — wants a replacement</p>
                <div className="mt-3 flex items-center gap-2 text-[12.5px] text-[#6e6e7a]">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#f2f2f6]">
                    <Camera className="h-4 w-4" />
                  </span>
                  1 photo from the customer
                </div>
              </div>
            </Card>,
            <Card key="Books for service businesses" title="Books for service businesses" body="Clinics, salons, restaurants: she takes the booking request and the team confirms.">
              <div className="rounded-2xl border border-[#ececf2] bg-white p-4">
                <div className="flex items-center gap-2 text-[13px] font-medium text-[#0b0b10]">
                  <CalendarCheck className="h-4 w-4 text-[var(--mk-accent)]" /> Table request
                </div>
                <p className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-[#0b0b10]">Sat · 7:00 pm</p>
                <p className="text-[13px] text-[#6e6e7a]">4 guests · birthday · window seat</p>
                <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#16a34a]/10 px-2.5 py-1 text-[12px] font-medium text-[#15803d]">
                  <Check className="h-3 w-3" /> Sent to the team
                </p>
              </div>
            </Card>,
            <Card key="Shows you where shoppers give up" title="Shows you where shoppers give up" body="Store Insights: where they tap, where they get stuck, and a weekly list of fixes.">
              <div className="rounded-2xl border border-[#ececf2] bg-white p-4">
                <p className="text-[12.5px] text-[#6e6e7a]">Where shoppers leave</p>
                {[
                  ['Product page', 100],
                  ['Cart', 46],
                  ['Shipping step', 19],
                ].map(([l, v]) => (
                  <div key={l as string} className="mt-2.5">
                    <div className="flex justify-between text-[12.5px] text-[#0b0b10]">
                      <span>{l}</span>
                      <span>{v}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-[#f2f2f6]">
                      <div className="h-2 rounded-full bg-[var(--mk-accent)]" style={{ width: `${v}%`, opacity: 0.35 + (Number(v) / 100) * 0.65 }} />
                    </div>
                  </div>
                ))}
                <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-medium text-[#b91c1c]">
                  <TrendingDown className="h-3.5 w-3.5" /> Biggest drop: shipping cost surprise
                </p>
              </div>
            </Card>,
            ]}
          </Carousel>
        </Reveal>

        <Reveal className="mt-4">
          <div className="flex flex-col items-start gap-4 rounded-[26px] border border-[#ececf2] bg-[#0b0b10] p-6 text-white sm:flex-row sm:items-center sm:p-8">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[19px] font-semibold tracking-[-0.02em]">Your checkout, untouched.</p>
              <p className="mt-1 text-[15px] leading-relaxed text-white/70">
                We never see card details — shoppers always pay on your own secure checkout. Answers come from your own products and policies, never made up.
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
