'use client';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

// Immediate feedback while the server action saves — without it the button
// looked dead for a second and owners clicked again.
export function CaseStatusButton({ resolved }: { resolved: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={resolved ? 'outline' : 'primary'} disabled={pending} aria-busy={pending}>
      {pending ? 'Saving…' : resolved ? 'Re-open' : 'Mark as handled'}
    </Button>
  );
}
