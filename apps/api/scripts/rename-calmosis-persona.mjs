// Switch SM-2SCCLZ from the generic calm-clinician persona (Sage) to the
// Calmosis-branded calmosis-clinician persona (Calmio).
import postgres from '../../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
const id = 'SM-2SCCLZ';

await sql`UPDATE merchants SET persona_id = ${'calmosis-clinician'} WHERE id = ${id}`;

const [row] = await sql`SELECT id, name, persona_id FROM merchants WHERE id=${id}`;
console.log(JSON.stringify(row, null, 2));
await sql.end();
