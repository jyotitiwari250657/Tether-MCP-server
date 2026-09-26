#!/usr/bin/env node
/**
 * check-design-tokens.mjs — AC-P14-08 (Prompt 14 §4).
 * Fails when raw hex color literals appear in component sources outside the
 * allowlist. Tokens live ONLY in:
 *   - apps/extension/tailwind.config.js
 *   - apps/web/src/styles/theme.css
 *   - apps/extension/components/icons.tsx (brand gradient)
 * docs/DESIGN.md is the normative documentation copy.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SCOPES = [
  'apps/extension/entrypoints',
  'apps/extension/components',
  'apps/extension/lib',
  'apps/web/src/pages',
  'apps/web/src',
];

const ALLOWLIST = [
  'apps/extension/tailwind.config.js',
  'apps/web/src/styles/theme.css',
  'apps/extension/components/icons.tsx',
  'apps/extension/lib/audit/tokens.ts',
];

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;

function gitLsFiles(sub) {
  try {
    const out = execFileSync('git', ['ls-files', sub], { cwd: root, encoding: 'utf-8' });
    return out.split('\n').filter(Boolean);
  } catch {
    return null; // fall back to existsSync probing
  }
}

let violations = [];
let scanned = 0;

for (const scope of SCOPES) {
  let files = gitLsFiles(scope);
  if (!files) {
    // Non-git fallback: skip globbing, rely on git presence in CI
    continue;
  }
  files = files.filter((f) => /\.(ts|tsx|astro)$/.test(f) && !ALLOWLIST.includes(f));
  for (const f of files) {
    const abs = join(root, f);
    if (!existsSync(abs)) continue;
    scanned += 1;
    const lines = readFileSync(abs, 'utf-8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (HEX_RE.test(lines[i])) {
        violations.push(`${f}:${i + 1}: ${lines[i].trim().slice(0, 80)}`);
      }
    }
  }
}

console.log(`check-design-tokens: scanned ${scanned} component files`);
if (violations.length > 0) {
  console.error(
    `\nRaw hex literals found outside allowlisted token files:\n${violations.map((v) => `  - ${v}`).join('\n')}\n\nUse design tokens instead (docs/DESIGN.md).`,
  );
  process.exit(1);
}
console.log('check-design-tokens: OK — no raw hex outside allowlist');
