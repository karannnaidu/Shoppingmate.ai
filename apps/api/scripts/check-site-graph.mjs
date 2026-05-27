import postgres from '../../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const tables = await sql`
  SELECT tablename FROM pg_tables
  WHERE schemaname='public'
    AND (tablename LIKE 'site_%' OR tablename LIKE 'page_%' OR tablename IN ('projection_cache','crawl_artifacts','faq_entries','policy_documents','media_index'))
  ORDER BY tablename
`;
console.log('SITE-GRAPH TABLES:');
for (const t of tables) console.log('  -', t.tablename);

const m = await sql`SELECT id, name, domain, site_graph_enabled, site_graph_version FROM merchants WHERE id='SM-XPK2EN'`;
console.log('DEMO MERCHANT:', m[0] ?? 'NOT FOUND');

await sql.end();
