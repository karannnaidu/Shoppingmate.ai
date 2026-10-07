import type { BrandTicket } from '@shoppingmate/db/schema';
import { Badge } from './v2';

export const KIND_LABEL: Record<string, string> = {
  bug: 'Bug',
  feature: 'Feature request',
  question: 'Question',
  billing: 'Billing',
  setup: 'Setup help',
  other: 'Request',
};

const STATUS: Record<string, { label: string; tone: 'neutral' | 'signal' | 'amber' | 'violet' | 'rose' }> = {
  open: { label: 'Received', tone: 'amber' },
  in_progress: { label: 'Being worked on', tone: 'violet' },
  done: { label: 'Done', tone: 'signal' },
  wont_do: { label: 'Not planned', tone: 'neutral' },
};

export function TicketStatusBadge({ status }: { status: BrandTicket['status'] }) {
  const s = STATUS[status] ?? STATUS.open!;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
