'use client';
import { useActionState, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type ReplyState, replyToCustomer } from './actions';

// Reply to the shopper by email without leaving the dashboard.
export function ReplyForm({ caseId, toEmail }: { caseId: number; toEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ReplyState, FormData>(replyToCustomer, null);
  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Send className="h-3.5 w-3.5" />
        {toEmail ? 'Reply to customer' : 'Add a note'}
      </Button>
    );
  }
  return (
    <form action={action} className="flex w-full flex-col gap-2">
      <input type="hidden" name="id" value={caseId} />
      <label className="text-xs text-text-muted" htmlFor={`reply-${caseId}`}>
        {toEmail ? `Emailed to ${toEmail} from your store's name. Their reply comes back to your inbox.` : 'This customer left no email — save a note for your team.'}
      </label>
      <textarea
        id={`reply-${caseId}`}
        name="message"
        required
        rows={3}
        maxLength={4000}
        className="w-full rounded-xl border border-border bg-surface-muted/60 p-3 text-sm text-text-primary outline-none focus:border-violet-500/60"
        placeholder={toEmail ? 'Hi, we’ve looked into this and…' : 'Called them, sending a replacement…'}
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
          {pending ? 'Sending…' : toEmail ? 'Send reply' : 'Save note'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {state && <span className={state.ok ? 'text-sm text-emerald-500' : 'text-sm text-rose-500'}>{state.message}</span>}
      </div>
    </form>
  );
}
