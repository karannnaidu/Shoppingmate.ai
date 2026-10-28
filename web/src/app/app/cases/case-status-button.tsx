'use client';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

const LABEL = { resolved: 'Mark as handled', in_progress: 'Mark in progress', open: 'Re-open' } as const;

// Immediate feedback while the server action saves — without it the button
// looked dead for a second and owners clicked again.
export function CaseStatusButton({ to }: { to: keyof typeof LABEL }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={to === 'resolved' ? 'primary' : 'outline'} disabled={pending} aria-busy={pending}>
      {pending ? 'Saving…' : LABEL[to]}
    </Button>
  );
}
