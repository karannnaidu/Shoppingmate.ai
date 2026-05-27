import postgres from '../../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const before = await sql`SELECT id, name, domain, allowed_domains, site_graph_enabled, site_graph_version FROM merchants WHERE id='SM-XPK2EN'`;
console.log('BEFORE:', before[0]);

await sql`
  UPDATE merchants
  SET site_graph_enabled = true,
      domain = 'shoppingmate-web.vercel.app',
      allowed_domains = CASE
        WHEN 'shoppingmate-web.vercel.app' = ANY(allowed_domains) THEN allowed_domains
        ELSE array_append(allowed_domains, 'shoppingmate-web.vercel.app')
      END
  WHERE id = 'SM-XPK2EN'
`;

const after = await sql`SELECT id, name, domain, allowed_domains, site_graph_enabled, site_graph_version FROM merchants WHERE id='SM-XPK2EN'`;
console.log('AFTER:', after[0]);

await sql.end();
