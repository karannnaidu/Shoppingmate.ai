import { MagicLinkForm } from '@/components/auth/MagicLinkForm';

export default function SignupPage() {
  return <MagicLinkForm mode="signup" callbackURL="/app/onboarding" />;
}
