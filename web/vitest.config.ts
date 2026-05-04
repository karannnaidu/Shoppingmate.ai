import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}', '*.test.{ts,tsx}'],
    globals: false,
    env: {
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      BETTER_AUTH_SECRET: 'test-secret-for-vitest-only',
      RESEND_API_KEY: 'test-resend-key',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      STRIPE_SECRET_KEY: 'sk_test_dummy',
      STRIPE_PRICE_STARTER_MONTHLY: 'price_test_starter',
      STRIPE_PRICE_GROWTH_MONTHLY: 'price_test_growth',
      STRIPE_PRICE_SCALE_MONTHLY: 'price_test_scale',
      STRIPE_PRICE_TOPUP_50: 'price_test_t50',
      STRIPE_PRICE_TOPUP_200: 'price_test_t200',
      STRIPE_PRICE_TOPUP_1000: 'price_test_t1000',
      STRIPE_PRICE_TOPUP_5000: 'price_test_t5000',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_dummy',
    },
  },
});
