import { MagicLinkForm } from '@/components/auth/MagicLinkForm';

export default function LoginPage() {
  return <MagicLinkForm mode="login" callbackURL="/app" />;
}
