import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { OnboardingWizard } from './OnboardingWizard';

afterEach(() => {
  cleanup();
});

describe('OnboardingWizard', () => {
  it('renders 4-step progress bar', () => {
    render(<OnboardingWizard step={2} merchant={null} />);
    expect(screen.getByText(/step 2 of 4/i)).toBeTruthy();
  });

  it('step 2 shows Start Starter plan CTA', () => {
    render(<OnboardingWizard step={2} merchant={null} />);
    expect(screen.getByRole('button', { name: /start.*starter/i })).toBeTruthy();
  });

  it('step 4 shows install snippet code block', () => {
    const merchant = {
      id: 'SM-ABCDEF',
      status: 'live',
      plan: 'starter',
      billingStatus: 'active',
      persona: null,
      leadWebhookUrl: null,
      knowledgeBaseStatus: 'empty',
      lastWidgetPing: null,
    };
    render(<OnboardingWizard step={4} merchant={merchant} />);
    expect(screen.getByText(/SM-ABCDEF/)).toBeTruthy();
    expect(screen.getByText(/cdn.shoppingmate.ai\/widget/)).toBeTruthy();
  });
});
