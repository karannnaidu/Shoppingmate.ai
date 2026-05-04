import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AlertBanner } from './AlertBanner';

afterEach(() => {
  cleanup();
});

describe('AlertBanner', () => {
  it('renders nothing when alert is null', () => {
    const { container } = render(<AlertBanner alert={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders override_failing copy + Accept fix action', () => {
    render(
      <AlertBanner
        alert={{
          id: 'a1',
          kind: 'override_failing',
          severity: 'warning',
          payload: { selector_key: 'add_to_cart' },
        }}
      />,
    );
    expect(screen.getByText(/add_to_cart/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /accept fix/i })).toBeTruthy();
  });

  it('renders payment_failed with Update payment link', () => {
    render(
      <AlertBanner
        alert={{ id: 'a2', kind: 'payment_failed', severity: 'critical', payload: {} }}
      />,
    );
    expect(screen.getByText(/last invoice failed/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /update payment/i })).toBeTruthy();
  });
});
