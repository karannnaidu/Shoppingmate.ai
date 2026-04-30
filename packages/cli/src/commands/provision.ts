import { db, schema } from '@shoppingmate/db';
import { generateMerchantId } from '@shoppingmate/shared';
import { validateDomain } from '../domain.js';
import { buildInstallSnippet } from '../snippet.js';

export type ProvisionArgs = {
  domain: string;
  name?: string;
  allow?: string[];
};

export async function provision(args: ProvisionArgs): Promise<void> {
  const primary = validateDomain(args.domain);
  const extras = (args.allow ?? []).map(validateDomain);
  const allowedDomains = Array.from(new Set([primary, ...extras]));

  const id = generateMerchantId();

  await db.insert(schema.merchants).values({
    id,
    domain: primary,
    name: args.name ?? null,
    allowedDomains,
    status: 'pending',
  });

  const snippet = buildInstallSnippet(id);
  console.log(`Created merchant ${id} for ${primary}`);
  if (args.name) console.log(`  name: ${args.name}`);
  if (allowedDomains.length > 1) console.log(`  allowed_domains: ${allowedDomains.join(', ')}`);
  console.log('\nInstall snippet (paste into <head> of the brand site):\n');
  console.log(snippet);
}
