import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ConversationsTable } from './ConversationsTable';

afterEach(cleanup);

const rows = [
  { id: 'c1', startedAt: new Date('2026-05-04T10:00:00Z'), durationSec: 107, turns: 6, mode: 'voice' as const, outcome: 'purchased' as const, attributedCents: 8900 },
  { id: 'c2', startedAt: new Date('2026-05-04T09:30:00Z'), durationSec: 32, turns: 2, mode: 'text' as const, outcome: 'abandoned' as const, attributedCents: null },
];

describe('ConversationsTable', () => {
  it('renders header columns', () => {
    render(<ConversationsTable rows={rows} />);
    expect(screen.getByText('When')).toBeTruthy();
    expect(screen.getByText('Length')).toBeTruthy();
    expect(screen.getByText('Result')).toBeTruthy();
  });

  it('renders empty state when rows empty', () => {
    render(<ConversationsTable rows={[]} />);
    expect(screen.getByText(/no conversations yet/i)).toBeTruthy();
  });

  it('renders mode + plain-English outcome, and the sale in the store currency', () => {
    render(<ConversationsTable rows={rows} currency="INR" />);
    expect(screen.getByText('voice')).toBeTruthy();
    expect(screen.getByText('Ordered')).toBeTruthy();
    expect(screen.getByText('Left without buying')).toBeTruthy();
    expect(screen.getByText('₹89')).toBeTruthy();
  });

  it('links every row to its conversation', () => {
    render(<ConversationsTable rows={rows} />);
    expect(document.querySelector('a[href="/app/conversations/c1"]')).toBeTruthy();
  });
});
