import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build, context } from 'esbuild';

const BUDGET_BYTES = 120 * 1024; // 120 KB gzip

const watch = process.argv.includes('--watch');

// Default to the Railway public URL until api.shoppingmate.ai DNS is configured.
// Override at build time with SHOPPINGMATE_API_BASE once the apex domain resolves.
const apiBase =
  process.env.SHOPPINGMATE_API_BASE ?? 'https://api-production-1ea1.up.railway.app';

// Persona portrait CDN base. Defaults to the Vercel-served public folder
// alongside the widget bundle (web/public/widget/personas/*.png).
const cdnBase =
  process.env.SHOPPINGMATE_CDN_BASE ?? 'https://shoppingmate-web.vercel.app/widget/personas';

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
    'globalThis.__SHOPPINGMATE_VOICE_STACK__': JSON.stringify(
      process.env.SHOPPINGMATE_VOICE_STACK ?? 'live-kit',
    ),
    'globalThis.__SHOPPINGMATE_CDN_BASE__': JSON.stringify(cdnBase),
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
  const distContent = bytes.toString('utf8');
  // Sentinels are SDK-internal class names that only appear if livekit-client
  // was statically bundled. The CDN URL substring is excluded — it's expected
  // to remain because the lazy-loader composes the URL at runtime.
  const SDK_SENTINELS = ['LocalParticipant', 'RemoteParticipant', 'RoomEvent.TrackSubscribed'];
  for (const sentinel of SDK_SENTINELS) {
    if (distContent.includes(sentinel)) {
      console.error(
        `[widget] FATAL: dist/v1.js contains "${sentinel}" — livekit-client appears statically bundled; must be lazy-loaded only`,
      );
      process.exit(1);
    }
  }
  console.log('[widget] OK: livekit-client absent from bundle (lazy-load only)');
}
