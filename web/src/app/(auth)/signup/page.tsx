import { MagicLinkForm } from '@/components/auth/MagicLinkForm';

// Carry the plan picked on the pricing page (?plan=growth) through sign-in to
// onboarding, so the owner lands on the plan they chose.
export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ plan?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const plan = sp.plan === 'growth' || sp.plan === 'scale' ? sp.plan : null;
  return <MagicLinkForm mode="signup" callbackURL={plan ? `/app/onboarding?plan=${plan}` : '/app/onboarding'} />;
}
