#!/usr/bin/env node

/**
 * CI Gate: Scans packages/**\/src and apps/**\/src for forbidden APIs (PRD HR-1, SEC-11, FR-103).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const FORBIDDEN_RULES = [
  {
    name: 'eval()',
    pattern: /\beval\s*\(/g,
    rule: 'PRD HR-1 / SEC-11 (No remote code / no dynamic evaluation)',
  },
  {
    name: 'new Function()',
    pattern: /new\s+Function\s*\(/g,
    rule: 'PRD HR-1 / SEC-11 (No dynamic function constructor)',
  },
  {
    name: 'Function()',
    pattern: /(?<![\w$.])Function\s*\(/g,
    rule: 'PRD HR-1 / SEC-11 (No direct Function invocation)',
  },
  {
    name: 'dynamic import(non-literal)',
    pattern: /\bimport\s*\((?!\s*['"`][^'"`]+['"`]\s*\))/g,
    rule: 'PRD HR-1 / SEC-11 (No non-literal dynamic import)',
  },
  {
    name: 'document.write',
    pattern: /document\.write/g,
    rule: 'PRD HR-1 (No document.write DOM injection)',
  },
  {
    name: 'chrome.cookies',
    pattern: /chrome\.cookies/g,
    rule: 'PRD FR-103 / SEC-11 (chrome.cookies forbidden in v1.0)',
  },
  {
    name: 'chrome.webRequest',
    pattern: /chrome\.webRequest/g,
    rule: 'PRD FR-103 / SEC-11 (chrome.webRequest forbidden in v1.0)',
  },
  {
    name: 'chrome.debugger',
    pattern: /chrome\.debugger/g,
    rule: 'PRD FR-103 / SEC-11 (chrome.debugger forbidden in v1.0)',
  },
  {
    name: 'remote <script src="http...">',
    pattern: /<script[^>]+src\s*=\s*['"]https?:\/\//gi,
    rule: 'PRD HR-1 / SEC-11 (No remote CDN scripts in extension)',
  },
];

function findSrcDirs(baseDir) {
  const dirs = [];
  if (!existsSync(baseDir)) return dirs;

  const entries = readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const candidate = join(baseDir, entry.name, 'src');
      if (existsSync(candidate)) {
        dirs.push(candidate);
      }
    }
  }
  return dirs;
}

function findFiles(dir) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'test' || entry.name === 'tests') {
        continue;
      }
      files.push(...findFiles(fullPath));
    } else if (entry.isFile()) {
      // Exclude test files
      if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.test.ts')) {
        continue;
      }
      if (/\.(ts|tsx|js|mjs|cjs|html)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

const root = process.cwd();
const targetDirs = [...findSrcDirs(join(root, 'packages')), ...findSrcDirs(join(root, 'apps'))];

const allFiles = [];
for (const dir of targetDirs) {
  allFiles.push(...findFiles(dir));
}

let violationsCount = 0;

for (const file of allFiles) {
  const relPath = relative(root, file).replace(/\\/g, '/');
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    for (const rule of FORBIDDEN_RULES) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(line)) {
        console.error(
          `FORBIDDEN API HIT: ${relPath}:${lineIdx + 1}\n` +
            `  Matched: ${rule.name}\n` +
            `  Rule:    ${rule.rule}\n` +
            `  Line:    ${line.trim()}`,
        );
        violationsCount++;
      }
    }
  }
}

if (violationsCount > 0) {
  console.error(`\nFAILED: Found ${violationsCount} forbidden API violation(s).`);
  process.exit(1);
}

console.log(`Forbidden API check passed. Scanned ${allFiles.length} files with zero violations.`);
process.exit(0);
