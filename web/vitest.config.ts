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
    },
  },
});
