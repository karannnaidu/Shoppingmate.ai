import * as catalog from './repos/catalogRepo.js';
import { selectorCacheRepo } from './repos/selectorCacheRepo.js';

export { db } from './client.js';
export type { DB } from './client.js';
export * as schema from './schema/index.js';
export * from './schema/index.js';
export { searchProducts, getProduct } from './repos/catalogRepo.js';
export { selectorCacheRepo } from './repos/selectorCacheRepo.js';

export const repos = { catalog, selectorCache: selectorCacheRepo };
