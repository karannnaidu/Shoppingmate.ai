import postgres from '../../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const cols = await sql`
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name='merchants' AND column_name IN ('brand_summary','brand_categories')
  ORDER BY column_name
`;
console.log('COLUMNS:');
for (const c of cols) console.log('  -', c);

const calmosis =
  await sql`SELECT id, name, brand_summary, brand_categories FROM merchants WHERE id='SM-2SCCLZ'`;
console.log('CALMOSIS:', calmosis[0] ?? 'NOT FOUND');

await sql.end();
