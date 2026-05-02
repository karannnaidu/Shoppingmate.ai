#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { adapterSmoke } from './commands/adapterSmoke.js';
import { provision } from './commands/provision.js';
import { retryOnboarding } from './commands/retryOnboarding.js';
import { show } from './commands/show.js';

const USAGE = `Usage:
  shoppingmate provision --domain=<host> [--name=<text>] [--allow=<host>,...]
  shoppingmate retry-onboarding <merchantId>
  shoppingmate show <merchantId>
  shoppingmate adapter-smoke <merchantId>
`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const subcommand = argv[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    console.log(USAGE);
    return;
  }

  switch (subcommand) {
    case 'provision': {
      const { values } = parseArgs({
        args: argv.slice(1),
        options: {
          domain: { type: 'string' },
          name: { type: 'string' },
          allow: { type: 'string' },
        },
        strict: true,
      });
      if (!values.domain) {
        console.error('--domain is required');
        process.exitCode = 1;
        return;
      }
      await provision({
        domain: values.domain,
        name: values.name,
        allow: values.allow ? values.allow.split(',') : undefined,
      });
      return;
    }
    case 'retry-onboarding': {
      const id = argv[1];
      if (!id) {
        console.error('merchantId argument is required');
        process.exitCode = 1;
        return;
      }
      await retryOnboarding(id);
      return;
    }
    case 'show': {
      const id = argv[1];
      if (!id) {
        console.error('merchantId argument is required');
        process.exitCode = 1;
        return;
      }
      await show(id);
      return;
    }
    case 'adapter-smoke': {
      const id = argv[1];
      if (!id) {
        console.error('usage: adapter-smoke <merchantId>');
        process.exitCode = 2;
        return;
      }
      const code = await adapterSmoke(id);
      process.exitCode = code;
      return;
    }
    default:
      console.error(`unknown subcommand: ${subcommand}\n${USAGE}`);
      process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    // Force exit so postgres + ioredis client pools don't hold the event loop open
    setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref();
  });
