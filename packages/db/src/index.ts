import * as catalog from './repos/catalogRepo.js';

export { db } from './client.js';
export type { DB } from './client.js';
export * as schema from './schema/index.js';
export * from './schema/index.js';
export { searchProducts, getProduct } from './repos/catalogRepo.js';

export const repos = { catalog };
