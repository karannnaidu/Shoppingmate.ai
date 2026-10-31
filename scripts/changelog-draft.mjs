#!/usr/bin/env node
// Lists feat/fix commits on main (last 60 days) that no changelog entry covers
// yet, so each push can add its changelog entry. See CLAUDE.md.
//   node scripts/changelog-draft.mjs [ref]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../web/src/content/changelog.ts', import.meta.url), 'utf8');
const logged = new Set([...src.matchAll(/'([0-9a-f]{7,})'/g)].map((m) => m[1].slice(0, 7)));
// What you're about to push (default HEAD; pass a ref to check another).
const REF = process.argv[2] ?? 'HEAD';
// execFile (no shell): the format string is safe on Windows cmd and POSIX alike.
const log = execFileSync('git', ['log', REF, '--since=60 days ago', '--pretty=format:%h	%ad	%s', '--date=short'], { encoding: 'utf8' });
const missing = log
  .split('\n')
  .map((l) => l.split('	'))
  .filter(([h, , s]) => h && /^(feat|fix)/.test(s ?? '') && !logged.has(h.slice(0, 7)));

if (missing.length === 0) {
  console.log('Changelog is up to date — every feat/fix commit is covered.');
} else {
  console.log(`${missing.length} feat/fix commit(s) not in web/src/content/changelog.ts yet:\n`);
  for (const [h, d, s] of missing) console.log(`  ${h}  ${d}  ${s}`);
  console.log('\nAdd an owner-friendly entry at the top of RELEASES (or extend today’s) with these hashes in `commits`.');
}
