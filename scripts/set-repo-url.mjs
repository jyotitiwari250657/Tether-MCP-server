#!/usr/bin/env node
/**
 * Rewrites the canonical repo URL across the placeholder inventory (AC-P13-05).
 *
 * Usage:
 *   node scripts/set-repo-url.mjs                                 # dry-run (default)
 *   node scripts/set-repo-url.mjs --url https://github.com/o/r    # apply
 *
 * Idempotent: re-running with the same URL makes no further changes.
 * Run `--dry-run` after manual edits to regenerate the inventory check.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
let url = null;
let dryRun = true;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) {
    url = args[i + 1];
    i++;
  } else if (args[i] === '--dry-run') {
    dryRun = true;
  }
}

const ASSUMED = 'https://github.com/tether-ai/tether';

if (url && !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(url)) {
  console.error(`Refusing non-conforming URL: ${url}\nExpected: https://github.com/<owner>/<repo>`);
  process.exit(1);
}

// [URL]-kind inventory entries from docs/PLACEHOLDERS.md (file + all match variants).
const TARGETS = [
  { file: 'README.md', patterns: [new RegExp(`${ASSUMED}\\.git`, 'g'), new RegExp(ASSUMED, 'g')] },
  {
    file: 'CONTRIBUTING.md',
    patterns: [new RegExp(`${ASSUMED}\\.git`, 'g'), new RegExp(ASSUMED, 'g')],
  },
];

// Dry-run is the default; providing --url opts in to actually write.
if (url) dryRun = false;

const root = process.cwd();
let changes = 0;

for (const { file, patterns } of TARGETS) {
  const path = join(root, file);
  let content;
  try {
    content = readFileSync(path, 'utf-8');
  } catch {
    console.warn(`skip (missing): ${file}`);
    continue;
  }
  const count = patterns.reduce((n, re) => n + (content.match(re)?.length ?? 0), 0);
  if (dryRun) {
    // Plain dry-run: report pending occurrences of the assumed URL.
    if (count > 0) console.log(`PENDING: ${file} (${count} occurrence(s) of assumed URL)`);
    else console.log(`no assumed URL present: ${file}`);
    changes += count;
    continue;
  }
  let next = content;
  for (const re of patterns) {
    next = next.replace(re, (m) => m.replace(ASSUMED, url));
  }
  if (next !== content) {
    console.log(`CHANGED: ${file} (${count} occurrence(s))`);
    writeFileSync(path, next, 'utf-8');
    changes += count;
  } else {
    console.log(`unchanged: ${file}`);
  }
}

if (dryRun) {
  console.log(
    '\nDry-run mode: no files written. Apply with --url https://github.com/<owner>/<repo>',
  );
}
console.log(`\n${changes} occurrence(s) ${dryRun ? 'detected' : 'rewritten'}.`);
if (url) {
  console.log('Reminder: update docs/PLACEHOLDERS.md rows #1-#2 status after applying.');
}
