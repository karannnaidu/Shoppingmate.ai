import postgres from '../../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const mid = process.argv[2] ?? 'SM-2SCCLZ';

const line = (s) => console.log(s);
line(`\n======== BRAND KNOWLEDGE-GRAPH AUDIT — ${mid} ========\n`);

// 1) Merchant + crawl status
const [m] = await sql`SELECT id, name, domain, adapter_type, site_graph_enabled FROM merchants WHERE id=${mid}`;
line(`merchant: ${m?.name} (${m?.domain})  adapter=${m?.adapter_type}  siteGraphEnabled=${m?.site_graph_enabled}`);

const crawls = await sql`SELECT id, status, page_count, started_at, finished_at, error_summary
  FROM site_crawls WHERE merchant_id=${mid} ORDER BY started_at DESC LIMIT 3`;
line(`\n-- site_crawls (latest 3) --`);
for (const c of crawls) line(`  ${c.status.padEnd(7)} pages=${String(c.page_count).padStart(3)}  started=${c.started_at?.toISOString?.() ?? c.started_at}  ${c.error_summary ? 'err='+c.error_summary : ''}`);

// 2) Pages by type
const pages = await sql`SELECT page_type, count(*)::int AS n FROM site_pages WHERE merchant_id=${mid} GROUP BY page_type ORDER BY n DESC`;
const totalPages = pages.reduce((s, r) => s + r.n, 0);
line(`\n-- site_pages: ${totalPages} total --`);
for (const p of pages) line(`  ${p.page_type.padEnd(12)} ${p.n}`);

// 3) Nav edges
const [{ n: edges }] = await sql`SELECT count(*)::int AS n FROM site_nav_edges WHERE merchant_id=${mid}`;
line(`\n-- site_nav_edges: ${edges} --`);

// 4) Page intents (the control hints) + selectorHint coverage
const [{ n: intents }] = await sql`SELECT count(*)::int AS n FROM page_intents WHERE merchant_id=${mid}`;
const [{ n: withSel }] = await sql`SELECT count(*)::int AS n FROM page_intents WHERE merchant_id=${mid} AND selector_hint IS NOT NULL AND selector_hint <> ''`;
line(`\n-- page_intents: ${intents} total, ${withSel} with selector_hint (${intents ? Math.round((withSel/intents)*100) : 0}%) --`);
const intentSample = await sql`SELECT intent_key, selector_hint FROM page_intents WHERE merchant_id=${mid} ORDER BY (selector_hint IS NOT NULL) DESC LIMIT 12`;
for (const i of intentSample) line(`  ${(i.intent_key||'').slice(0,42).padEnd(44)} ${i.selector_hint ? '→ '+i.selector_hint.slice(0,60) : '(no selector)'}`);

// 5) FAQ / policy / media
const [{ n: faqs }] = await sql`SELECT count(*)::int AS n FROM faq_entries WHERE merchant_id=${mid}`;
const [{ n: policies }] = await sql`SELECT count(*)::int AS n FROM policy_documents WHERE merchant_id=${mid}`;
const [{ n: media }] = await sql`SELECT count(*)::int AS n FROM media_index WHERE merchant_id=${mid}`;
line(`\n-- faq_entries=${faqs}  policy_documents=${policies}  media_index=${media} --`);

// 6) Projection cache (the text actually fed to the model)
const proj = await sql`SELECT consumer, length(output) AS chars, source_graph_version, generated_at FROM projection_cache WHERE merchant_id=${mid} ORDER BY consumer`;
line(`\n-- projection_cache --`);
if (proj.length === 0) line('  (NONE — model gets no site map!)');
for (const p of proj) line(`  ${p.consumer.padEnd(16)} ${String(p.chars).padStart(6)} chars  v${p.source_graph_version}  ${p.generated_at?.toISOString?.() ?? p.generated_at}`);

// 7) Sample the sonnet_addendum projection (what the bot actually sees)
const [addendum] = await sql`SELECT output FROM projection_cache WHERE merchant_id=${mid} AND consumer='sonnet_addendum'`;
if (addendum) {
  line(`\n-- sonnet_addendum projection (first 1500 chars the bot sees) --`);
  line(addendum.output.slice(0, 1500));
  line(`  …[${addendum.output.length} chars total]`);
}

await sql.end();
line('\n======== END AUDIT ========\n');
