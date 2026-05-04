import { gzipSync } from 'node:zlib';
import { build, context } from 'esbuild';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BUDGET_BYTES = 120 * 1024; // 120 KB gzip

const watch = process.argv.includes('--watch');

const apiBase = process.env.SHOPPINGMATE_API_BASE ?? 'https://api.shoppingmate.ai';

const options = {
  entryPoints: [resolve(import.meta.dirname, '../src/index.ts')],
  outfile: resolve(import.meta.dirname, '../dist/v1.js'),
  bundle: true,
  format: 'iife' as const,
  target: ['es2020'],
  minify: !watch,
  sourcemap: watch ? ('inline' as const) : false,
  legalComments: 'none' as const,
  define: {
    'process.env.SHOPPINGMATE_API_BASE': JSON.stringify(apiBase),
  },
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('[widget] watching…');
} else {
  await build(options);
  const bytes = readFileSync(options.outfile);
  const gz = gzipSync(bytes).length;
  const pct = ((gz / BUDGET_BYTES) * 100).toFixed(1);
  console.log(
    `[widget] ${options.outfile}: ${bytes.length} bytes raw, ${gz} bytes gzip (${pct}% of ${BUDGET_BYTES} budget)`,
  );
  if (gz > BUDGET_BYTES) {
    console.error(`[widget] FAIL: bundle exceeds ${BUDGET_BYTES}-byte gzip budget`);
    process.exit(1);
  }
}
