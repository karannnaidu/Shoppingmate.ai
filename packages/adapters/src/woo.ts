import type { Adapter } from './types.js';

export class WooAdapter implements Partial<Adapter> {
  readonly kind = 'woo' as const;
}
