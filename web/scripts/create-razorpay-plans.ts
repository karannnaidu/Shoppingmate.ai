import Razorpay from 'razorpay';

// One-off. Run once per Razorpay account (test, then live):
//   $env:RAZORPAY_KEY_ID="..."; $env:RAZORPAY_KEY_SECRET="..."; $env:BILLING_CURRENCY="USD"
//   pnpm --filter web exec tsx scripts/create-razorpay-plans.ts
// Paste the printed RAZORPAY_PLAN_* lines into the service env.

const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});
const currency = process.env.BILLING_CURRENCY ?? 'USD';

const plans = [
  { key: 'STARTER', name: 'shoppingmate Starter', amount: 3000 }, // $30.00
  { key: 'GROWTH', name: 'shoppingmate Growth', amount: 9900 }, // $99.00
  { key: 'SCALE', name: 'shoppingmate Scale', amount: 29900 }, // $299.00
];

for (const p of plans) {
  const plan = (await rzp.plans.create({
    period: 'monthly',
    interval: 1,
    item: { name: p.name, amount: p.amount, currency },
  })) as { id: string };
  console.log(`RAZORPAY_PLAN_${p.key}=${plan.id}`);
}
