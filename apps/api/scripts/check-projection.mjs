import postgres from '../../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const rows = await sql`SELECT consumer, generated_at, length(output) AS sz, left(output, 800) AS preview FROM projection_cache WHERE merchant_id='SM-2SCCLZ'`;
for (const r of rows) {
  console.log('consumer:', r.consumer);
  console.log('generated_at:', r.generated_at);
  console.log('size:', r.sz);
  console.log('preview:', r.preview);
  console.log('---');
}
console.log('total:', rows.length);
await sql.end();
