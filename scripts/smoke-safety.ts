#!/usr/bin/env node
import { safetyCheck } from '../apps/worker/src/steps/safetyCheck.js';

const TEST_THREAT = 'testsafebrowsing.appspot.com';
const TEST_CLEAN = 'example.com';

async function main(): Promise<void> {
  console.log(`Checking known-malicious test domain: ${TEST_THREAT}`);
  const flagged = await safetyCheck(TEST_THREAT);
  console.log('  result:', flagged);
  if (flagged.kind !== 'flagged') {
    console.error('  ❌ EXPECTED FLAGGED — check API key and quota');
    process.exitCode = 1;
  } else {
    console.log('  ✅ OK');
  }

  console.log(`\nChecking known-clean control domain: ${TEST_CLEAN}`);
  const clean = await safetyCheck(TEST_CLEAN);
  console.log('  result:', clean);
  if (clean.kind !== 'clean') {
    console.error('  ❌ EXPECTED CLEAN — investigate');
    process.exitCode = 1;
  } else {
    console.log('  ✅ OK');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
