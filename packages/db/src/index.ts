import * as catalog from './repos/catalogRepo.js';
import { selectorCacheRepo } from './repos/selectorCacheRepo.js';

export { db } from './client.js';
export type { DB } from './client.js';
export * as schema from './schema/index.js';
export * from './schema/index.js';
export { searchProducts, getProduct } from './repos/catalogRepo.js';
export { selectorCacheRepo } from './repos/selectorCacheRepo.js';
export { createConsultationRequest } from './repos/consultationRepo.js';
export {
  loadVisitorProfile,
  upsertVisitorProfile,
  mergeProfile,
} from './repos/visitorProfileRepo.js';
export type { ProfileRow } from './repos/visitorProfileRepo.js';
export { submitConsultationRequest } from './notify/submitConsultation.js';
export type { SubmitConsultationArgs } from './notify/submitConsultation.js';

export const repos = { catalog, selectorCache: selectorCacheRepo };
