import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Sidebar } from './Sidebar';

afterEach(() => {
  cleanup();
});

describe('Sidebar', () => {
  it('renders all primary nav links', () => {
    render(<Sidebar pathname="/app" />);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Conversations')).toBeTruthy();
    expect(screen.getByText('Audit')).toBeTruthy();
    expect(screen.getByText('Knowledge')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Billing')).toBeTruthy();
  });

  it('does NOT render Diagnostics in nav (banner-only landing)', () => {
    render(<Sidebar pathname="/app" />);
    expect(screen.queryByText('Diagnostics')).toBeNull();
  });

  it('shows Consultations only for the Calmosis tenant', () => {
    render(<Sidebar pathname="/app" merchantId="SM-2SCCLZ" />);
    expect(screen.getByText('Consultations')).toBeTruthy();
  });

  it('hides Consultations for other tenants', () => {
    render(<Sidebar pathname="/app" merchantId="SM-OTHER" />);
    expect(screen.queryByText('Consultations')).toBeNull();
  });

  it('marks current path active', () => {
    render(<Sidebar pathname="/app/billing" />);
    const billingLink = screen.getByText('Billing').closest('a');
    expect(billingLink?.getAttribute('aria-current')).toBe('page');
  });
});
