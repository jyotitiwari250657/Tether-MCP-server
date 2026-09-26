#!/usr/bin/env node

/**
 * Validates that all requirement IDs cited in packages/protocol exist verbatim
 * in PRD.md or TRD.md (PRD §0, AGENTS.md, AC-P03-16).
 * Fails CI on any invented or fabricated requirement ID.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const prdPath = existsSync(join(root, 'PRD.md'))
  ? join(root, 'PRD.md')
  : join(root, 'docs', 'PRD.md');
const trdPath = existsSync(join(root, 'TRD.md'))
  ? join(root, 'TRD.md')
  : join(root, 'docs', 'TRD.md');

if (!existsSync(prdPath) || !existsSync(trdPath)) {
  console.error('ERROR: Missing PRD.md or TRD.md.');
  process.exit(1);
}

const ID_PATTERN = /\b(FR|NFR|SEC|HR|NG|PRV|CMP|TOOL|MET|RK|OQ|AC)-[A-Z0-9]+\b/g;

function extractValidIds(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const ids = new Set();
  let match = ID_PATTERN.exec(content);
  while (match !== null) {
    ids.add(match[0]);
    match = ID_PATTERN.exec(content);
  }
  return ids;
}

const validIds = new Set([...extractValidIds(prdPath), ...extractValidIds(trdPath)]);

function findTsFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.output') {
        continue;
      }
      files.push(...findTsFiles(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const protocolDir = join(root, 'packages', 'protocol');
const filesToScan = findTsFiles(protocolDir);
let hasError = false;
let totalCitations = 0;
const citedIds = new Set();

for (const file of filesToScan) {
  const content = readFileSync(file, 'utf-8');
  let match = ID_PATTERN.exec(content);
  while (match !== null) {
    const id = match[0];
    totalCitations++;
    citedIds.add(id);
    if (!validIds.has(id)) {
      console.error(`ERROR: Fabricated/unauthorised requirement ID "${id}" in ${file}`);
      hasError = true;
    }
    match = ID_PATTERN.exec(content);
  }
}

if (hasError) {
  console.error('\nCI check failed: Invented requirement IDs detected.');
  process.exit(1);
}

console.log(
  `[check-requirement-ids] Verified ${totalCitations} citations (${citedIds.size} unique IDs) across ${filesToScan.length} files. All exist in PRD.md / TRD.md.`,
);
process.exit(0);
