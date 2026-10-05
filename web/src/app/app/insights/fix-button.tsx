'use client';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

export function FixButton({ done }: { done: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={done ? 'outline' : 'primary'} disabled={pending}>
      {pending ? 'Saving…' : done ? 'Not done yet' : 'Mark as done'}
    </Button>
  );
}
