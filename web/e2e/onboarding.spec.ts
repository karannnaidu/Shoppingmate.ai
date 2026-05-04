import { test, expect } from '@playwright/test';

test('signup → magic-link request renders confirmation', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('input[type=email]', `e2e-${Date.now()}@shoppingmate.test`);
  await page.click('button[type=submit]');
  await expect(page.getByText(/check your inbox/i)).toBeVisible();
});

// NOTE: full happy-path (Stripe Checkout → Composio connect → install → home) is run
// manually against the dev environment per docs/runbooks/2026-05-04-phase2-acceptance.md.
// Automating it requires a test mailbox + Stripe test-clock harness and is deferred to
// Phase 2.5 polish.
