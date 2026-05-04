import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { KpiTile } from './KpiTile';

afterEach(cleanup);

describe('KpiTile', () => {
  it('renders label, value and trend arrow', () => {
    render(<KpiTile label="Conversations" value="124" delta={0.18} />);
    expect(screen.getByText('Conversations')).toBeTruthy();
    expect(screen.getByText('124')).toBeTruthy();
    expect(screen.getByText(/18%/)).toBeTruthy();
  });

  it('renders down arrow for negative delta', () => {
    render(<KpiTile label="Voice ratio" value="12%" delta={-0.05} />);
    expect(screen.getByText(/↓/)).toBeTruthy();
  });
});
