import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SignupPage from './page';

// SignupPage is an async server component (reads ?plan=) — await it, then render.

afterEach(() => {
  cleanup();
  delete process.env.NEXT_PUBLIC_GOOGLE_ENABLED;
});

describe('SignupPage', async () => {
  it('renders a labelled email input and the create-account button', async () => {
    render(await SignupPage({}));
    expect(screen.getByLabelText(/work email/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /create my account/i })).toBeTruthy();
  });

  it('shows Continue with Google only when Google sign-in is enabled', async () => {
    render(await SignupPage({}));
    expect(screen.queryByRole('button', { name: /continue with google/i })).toBeNull();
    cleanup();
    process.env.NEXT_PUBLIC_GOOGLE_ENABLED = 'true';
    render(await SignupPage({}));
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy();
  });

  it('states the starting price and links existing owners to log in', async () => {
    render(await SignupPage({}));
    expect(screen.getByText(/plans start at \$30\/month/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /log in/i }).getAttribute('href')).toBe('/login');
  });
});
