#!/usr/bin/env node

/**
 * CI Gate: Enforces Zero-Plaintext-at-Rest schema rules on Relay D1 migrations (PRD PRV-03, TRD Appendix B).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'apps', 'relay', 'migrations');
if (!existsSync(MIGRATIONS_DIR)) {
  console.log('no relay schema yet — skipping (P14)');
  process.exit(0);
}

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => join(MIGRATIONS_DIR, f));

if (migrationFiles.length === 0) {
  console.log('no relay schema yet — skipping (P14)');
  process.exit(0);
}

const SENSITIVE_COLUMN_NAMES = [
  'url',
  'body',
  'content',
  'args',
  'value',
  'secret',
  'html',
  'text',
];

// Load allowlist if exists
const ALLOWLIST_PATH = join(process.cwd(), 'apps', 'relay', 'src', 'store', 'allowlist.ts');
const allowlistNames = new Set();

if (existsSync(ALLOWLIST_PATH)) {
  const allowlistContent = readFileSync(ALLOWLIST_PATH, 'utf-8');
  for (const name of SENSITIVE_COLUMN_NAMES) {
    if (allowlistContent.includes(`'${name}'`) || allowlistContent.includes(`"${name}"`)) {
      allowlistNames.add(name);
    }
  }
}

let violations = 0;

for (const file of migrationFiles) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    // Simple SQL column definition regex: column_name TYPE ...
    for (const sensitive of SENSITIVE_COLUMN_NAMES) {
      const colRegex = new RegExp(`\\b${sensitive}\\b\\s+(TEXT|BLOB|INTEGER|VARCHAR|JSON)`, 'i');
      if (colRegex.test(line)) {
        if (!allowlistNames.has(sensitive)) {
          console.error(
            `ERROR: Sensitive column '${sensitive}' found in ${file}:${idx + 1}\n  Line: ${line}\n  Rule: PRD PRV-03 / TRD Appendix B forbids cleartext columns without entry in store/allowlist.ts`,
          );
          violations++;
        }
      }
    }
  }
}

if (violations > 0) {
  console.error(`\nFAILED: Found ${violations} forbidden schema column(s).`);
  process.exit(1);
}

console.log('Relay schema check passed.');
process.exit(0);
