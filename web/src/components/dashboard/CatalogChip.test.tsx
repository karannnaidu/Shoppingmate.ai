import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CatalogChip } from './CatalogChip';

afterEach(cleanup);

describe('CatalogChip', () => {
  it('renders synced state with product count', () => {
    const recent = new Date(Date.now() - 4 * 60 * 1000);
    render(<CatalogChip syncedAt={recent} productCount={327} />);
    expect(screen.getByText(/327/)).toBeTruthy();
    expect(screen.getByText(/min ago/)).toBeTruthy();
  });

  it('renders stale state when older than 24h', () => {
    const stale = new Date(Date.now() - 26 * 3600 * 1000);
    render(<CatalogChip syncedAt={stale} productCount={100} />);
    expect(screen.getByText(/stale/i)).toBeTruthy();
  });
});
