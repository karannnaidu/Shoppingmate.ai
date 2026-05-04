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
    expect(screen.getByText('Started')).toBeTruthy();
    expect(screen.getByText('Duration')).toBeTruthy();
    expect(screen.getByText('Outcome')).toBeTruthy();
  });

  it('renders empty state when rows empty', () => {
    render(<ConversationsTable rows={[]} />);
    expect(screen.getByText(/no conversations yet/i)).toBeTruthy();
  });

  it('renders mode + outcome cells', () => {
    render(<ConversationsTable rows={rows} />);
    expect(screen.getByText('voice')).toBeTruthy();
    expect(screen.getByText('purchased')).toBeTruthy();
    expect(screen.getByText('abandoned')).toBeTruthy();
  });
});
