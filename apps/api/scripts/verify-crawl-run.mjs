import postgres from '../../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const m = await sql`SELECT id, name, domain, site_graph_enabled, site_graph_version FROM merchants WHERE id='SM-XPK2EN'`;
console.log('MERCHANT:', m[0]);

const crawls = await sql`SELECT * FROM site_crawls WHERE merchant_id='SM-XPK2EN' ORDER BY started_at DESC NULLS LAST LIMIT 5`;
console.log('CRAWLS (last 5):');
for (const c of crawls) console.log('  -', c);

const pages = await sql`SELECT count(*) as n FROM site_pages WHERE merchant_id='SM-XPK2EN'`;
console.log('PAGES count:', pages[0].n);

const proj = await sql`SELECT * FROM projection_cache WHERE merchant_id='SM-XPK2EN'`;
console.log('PROJECTIONS:');
for (const p of proj) console.log('  -', p);

const arts = await sql`SELECT id, merchant_id, kind, created_at FROM crawl_artifacts WHERE merchant_id='SM-XPK2EN' ORDER BY created_at DESC LIMIT 3`;
console.log('ARTIFACTS (last 3):');
for (const a of arts) console.log('  -', a);

await sql.end();
