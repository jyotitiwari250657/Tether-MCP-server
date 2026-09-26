#!/usr/bin/env node

/**
 * CI Gate: Validates manifest permissions against PERMISSIONS.md (PRD HR-3, FR-102, FR-103, TRD §6.2).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const EXT_DIR = join(process.cwd(), 'apps', 'extension');
if (!existsSync(EXT_DIR)) {
  console.log('no manifest yet — skipping (P04)');
  process.exit(0);
}

const entries = readdirSync(EXT_DIR);
const manifestFiles = entries
  .filter((name) => name.startsWith('manifest') && name.endsWith('.json'))
  .map((name) => join(EXT_DIR, name));

if (manifestFiles.length === 0) {
  console.log('no manifest yet — skipping (P04)');
  process.exit(0);
}

// Load PERMISSIONS.md
const permissionsPath = join(process.cwd(), 'PERMISSIONS.md');
if (!existsSync(permissionsPath)) {
  console.error('ERROR: PERMISSIONS.md not found at repository root.');
  process.exit(1);
}

const permissionsContent = readFileSync(permissionsPath, 'utf-8');

// Parse Table 1 (Permitted) and Table 2 (Forbidden)
const table1Match = permissionsContent.match(
  /## Table 1 — Permitted Manifest Permissions[\s\S]*?(?=## Table 2|$)/,
);
const table2Match = permissionsContent.match(/## Table 2 — Forbidden Permissions[\s\S]*?(?=$)/);

function extractCodes(sectionText) {
  const codes = new Set();
  if (!sectionText) return codes;
  // Match permission code in column 1 of markdown table: | `permission` |
  const matches = sectionText.matchAll(/^\|\s*`([^`]+)`/gm);
  for (const match of matches) {
    const perm = match[1].trim();
    if (perm && !perm.includes('(') && !perm.includes(')')) {
      codes.add(perm);
    }
  }
  return codes;
}

const permitted = extractCodes(table1Match ? table1Match[0] : '');
const forbidden = extractCodes(table2Match ? table2Match[0] : '');

let hasError = false;

for (const manifestPath of manifestFiles) {
  const manifestRaw = readFileSync(manifestPath, 'utf-8');
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (err) {
    console.error(`ERROR: Failed to parse JSON manifest at ${manifestPath}: ${err.message}`);
    hasError = true;
    continue;
  }

  const manifestPermissions = [
    ...(manifest.permissions || []),
    ...(manifest.optional_permissions || []),
    ...(manifest.host_permissions || []),
    ...(manifest.optional_host_permissions || []),
  ];

  for (const perm of manifestPermissions) {
    // Check if explicitly forbidden (Table 2)
    if (forbidden.has(perm)) {
      console.error(`ERROR: Forbidden permission '${perm}' found in ${manifestPath} (PRD FR-103).`);
      hasError = true;
    }

    // Check if missing from permitted table (Table 1)
    if (!permitted.has(perm)) {
      console.error(
        `ERROR: Permission '${perm}' in ${manifestPath} is not justified in PERMISSIONS.md Table 1 (PRD HR-3).`,
      );
      hasError = true;
    }
  }
}

if (hasError) {
  console.error('\nFAILED: Manifest permissions check failed.');
  process.exit(1);
}

console.log('Manifest permissions check passed.');
process.exit(0);
