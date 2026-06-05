import postgres from '../../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const rows = await sql`SELECT sku, title, price_cents, currency, in_stock, source, source_meta FROM products WHERE merchant_id='SM-2SCCLZ' ORDER BY sku`;
for (const r of rows) console.log(r.sku, '|', r.title, '|', r.price_cents, r.currency, '| brand=', r.source_meta?.brand ?? 'n/a', '| stock=', r.in_stock, '| src=', r.source);
console.log('---total:', rows.length);
await sql.end();
