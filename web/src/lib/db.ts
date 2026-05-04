import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@shoppingmate/db/schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | null = null;

function getDb(): Db {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const client = postgres(connectionString, { max: 5 });
  _db = drizzle(client, { schema });
  return _db;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const c = getDb();
    const v = (c as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(c) : v;
  },
});

export { schema };
