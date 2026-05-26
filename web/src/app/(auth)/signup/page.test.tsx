import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SignupPage from './page';

afterEach(cleanup);

describe('SignupPage', () => {
  it('renders email input and submit button', () => {
    render(<SignupPage />);
    // placeholder is "you@brand.com" — match on the brand part
    expect(screen.getByPlaceholderText(/you@brand/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^sign up$/i })).toBeTruthy();
  });

  it('renders Continue with Google button', () => {
    render(<SignupPage />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy();
  });

  it('shows shoppingmate brand mark', () => {
    render(<SignupPage />);
    expect(screen.getByText(/shoppingmate/i)).toBeTruthy();
  });
});
