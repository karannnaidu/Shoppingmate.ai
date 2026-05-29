import postgres from '../../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

const MID = 'SM-2SCCLZ';

const SUMMARY = [
  'Calmosis is an Indian ayurvedic wellness brand producing full-spectrum',
  'cannabis-based products (THC + CBD, hemp-derived) crafted with classical',
  'ayurvedic herbs and terpenes. Their range covers tinctures, capsules, and',
  'topicals targeted at sleep, anxiety, chronic pain, recovery, and overall',
  'well-being. Calmosis emphasises practitioner-guided use — visitors are',
  'encouraged to consult an ayurvedic doctor before choosing a dosage. All',
  'products ship discreetly within India and are AYUSH-licensed.',
].join(' ');

const CATEGORIES = [
  'ayurveda',
  'wellness',
  'cannabis',
  'cbd',
  'thc',
  'sleep',
  'pain-relief',
  'anxiety',
  'recovery',
  'tinctures',
  'capsules',
  'topicals',
];

const before =
  await sql`SELECT id, name, brand_summary, brand_categories FROM merchants WHERE id=${MID}`;
console.log('BEFORE:', before[0] ?? 'NOT FOUND');

if (!before[0]) {
  console.error('Merchant not found — aborting');
  await sql.end();
  process.exit(1);
}

await sql`
  UPDATE merchants
  SET brand_summary = ${SUMMARY},
      brand_categories = ${CATEGORIES}
  WHERE id = ${MID}
`;

const after =
  await sql`SELECT id, name, brand_summary, brand_categories FROM merchants WHERE id=${MID}`;
console.log('AFTER:', after[0]);

await sql.end();
