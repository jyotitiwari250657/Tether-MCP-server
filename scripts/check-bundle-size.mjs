#!/usr/bin/env node

/**
 * Enforces uncompressed bundle size limits on extension build (TRD §11, ADR S8).
 *
 * Tiers (P10 Task 1):
 *   <= 380 KB  OK    (release target: >= 20 KB headroom against the hard gate)
 *   >  380 KB  WARN  (allowed in CI, must be justified in the release notes)
 *   >  400 KB  FAIL  (hard gate, build-blocking)
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const DEFAULT_MAX_KB = 400;
const WARN_KB = 380;
let maxKb = DEFAULT_MAX_KB;
let customMax = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--max-kb' && args[i + 1]) {
    maxKb = Number.parseFloat(args[i + 1]);
    customMax = true;
    i++;
  }
}

const EXT_OUTPUT_DIR = join(process.cwd(), 'apps', 'extension', '.output');

if (!existsSync(EXT_OUTPUT_DIR)) {
  console.log('no extension build yet — skipping (P04)');
  process.exit(0);
}

function getFilesRecursively(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

const allFiles = getFilesRecursively(EXT_OUTPUT_DIR);
// Icons and non-code assets are excluded from uncompressed JS size cap (TRD §11)
const jsFiles = allFiles.filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));

let totalBytes = 0;
for (const file of jsFiles) {
  const stat = statSync(file);
  totalBytes += stat.size;
}

const totalKb = totalBytes / 1024;
console.log(
  `Extension uncompressed JS size: ${totalKb.toFixed(2)} KB (fail: ${maxKb} KB, warn: ${WARN_KB} KB)`,
);

if (totalKb > maxKb) {
  console.error(
    `ERROR: Extension bundle size ${totalKb.toFixed(2)} KB exceeds limit of ${maxKb} KB`,
  );
  process.exit(1);
}

if (totalKb > WARN_KB && !customMax) {
  console.warn(
    `WARNING: Extension bundle size ${totalKb.toFixed(2)} KB is above the ${WARN_KB} KB release target. ` +
      `>= 20 KB headroom against the ${maxKb} KB hard gate is required for v0.1.0 (TRD §11). Justify in the release notes or shrink the bundle.`,
  );
} else {
  console.log('Bundle size within budget.');
}

process.exit(0);
