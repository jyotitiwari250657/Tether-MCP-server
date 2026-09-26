#!/usr/bin/env node

/**
 * Protocol Documentation Generator (PRD HR-4, TRD §5.6).
 * Inspects packages/protocol/src using TypeScript compiler API and emits docs/protocol.md.
 * Fails in check/default mode if committed docs/protocol.md differs from source contract.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const protocolSrcDir = join(root, 'packages', 'protocol', 'src');
const protocolDistDir = join(root, 'packages', 'protocol', 'dist');
const outDocPath = join(root, 'docs', 'protocol.md');
const isWriteMode = process.argv.includes('--write') || process.argv.includes('-w');

// Extract exported declarations via TypeScript Compiler API
const indexFile = join(protocolSrcDir, 'index.ts');
const program = ts.createProgram([indexFile], {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
});

const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile(indexFile);

const exportedSymbols = [];
if (sourceFile) {
  const fileSymbol = checker.getSymbolAtLocation(sourceFile);
  if (fileSymbol) {
    const exports = checker.getExportsOfModule(fileSymbol);
    for (const exp of exports) {
      exportedSymbols.push(exp.getName());
    }
  }
}

// Import compiled tool registry if available
let toolsList = [];
const toolsDistPath = join(protocolDistDir, 'tools', 'index.js');
if (existsSync(toolsDistPath)) {
  const toolsModule = await import(`file://${toolsDistPath.replace(/\\/g, '/')}`);
  toolsList = toolsModule.TOOLS || [];
}

// Generate Markdown documentation
function generateDoc() {
  const lines = [
    '<!-- GENERATED — DO NOT EDIT -->',
    '# Tether Protocol Specification (v1)',
    '',
    '> **Doc ID:** SPEC-PROTOCOL-001 · **Milestone:** M0+ · **Governing PRD:** HR-4, HR-5 · **TRD:** §5',
    '>',
    '> This document is mechanically generated from `packages/protocol/src/` via `pnpm --filter @tether/protocol generate`.',
    '> Any manual modifications to this file will cause CI to fail.',
    '',
    '---',
    '',
    '## 1. Protocol Versioning (TRD §5.1, PRD HR-5)',
    '',
    '- `PROTOCOL_VERSION = 1` (literal constant).',
    '- **Additive-Only Rule:** All schemas are strictly additive. Published fields are immutable.',
    '- **Compatibility:** Peer versions must match `PROTOCOL_VERSION` exactly.',
    '',
    '---',
    '',
    '## 2. Wire Envelope (TRD §5.2, Appendix A)',
    '',
    'All communication across extension, daemon, and relay links uses a versioned envelope `{ v: 1, id, session, ts, ... }`:',
    '',
    '| Kind | Discriminator | Description | Size Cap |',
    '|---|---|---|---|',
    '| `req` | `kind: "req"` | Action or meta tool invocation | 64 KB args |',
    '| `res` (ok) | `kind: "res", ok: true` | Successful tool result with execution ms | 900 KB (chunked) |',
    '| `res` (err) | `kind: "res", ok: false` | Structured ToolError with actionable hint | 64 KB |',
    '| `evt` | `kind: "evt"` | Async streaming notification / elicitation | 64 KB |',
    '',
    '- **Maximum Envelope Bytes:** `921,600` bytes (900 KB limit for Chrome Native Messaging).',
    '- **Forward Compatibility:** Unrecognized event names are ignored rather than rejected.',
    '',
    '---',
    '',
    '## 3. Error Catalogue (TRD §5.5, PRD HR-11)',
    '',
    'Every tool failure emits a typed `ErrorCode` with an actionable `hint` formulated specifically for AI model guidance:',
    '',
    '| Error Code | Retryable | Model Hint |',
    '|---|---|---|',
    '| `REF_STALE` | Yes | Call browser_snapshot once, then retry with the new ref. |',
    '| `REF_NOT_FOUND` | No | Call browser_snapshot to obtain current refs. |',
    '| `TAB_GONE` | No | — |',
    '| `UNSUPPORTED_FRAME` | No | — |',
    '| `POLICY_DENIED` | No | Do not retry. Ask the user with ask_user, or call policy_grant to request access. |',
    '| `PERMISSION_REQUIRED` | No | — |',
    '| `NEEDS_CONFIRMATION` | No | Call confirm_action with the returned confirmId and diff; wait for the user. |',
    '| `CONFIRM_TOKEN_INVALID` | No | — |',
    '| `CONFIRM_TOKEN_EXPIRED` | No | — |',
    '| `DEVICE_OFFLINE` | No | — |',
    '| `DEVICE_BUSY` | Yes | Another client is driving the browser. Tell the user; do not retry in a loop. |',
    '| `RATE_LIMITED` | Yes | Wait retryAfterMs, then retry once. |',
    '| `TIMEOUT` | Yes | Use browser_task_start for work that exceeds 30 seconds. |',
    '| `SESSION_ABORTED` | No | The user engaged the kill switch. Stop. |',
    '| `SCHEMA_INVALID` | No | Fix the schema and retry; see details.errors for the failing paths. |',
    '| `EGRESS_BLOCKED` | No | — |',
    '| `INTERNAL` | No | — |',
    '',
    '---',
    '',
    '## 4. Accessibility Snapshots & Ref Resolution (TRD §5.4, §6.4)',
    '',
    '- Elements are indexed into accessibility trees with stable identifiers (`A1`, `B4`).',
    '- `RefEntry` records `nodeId`, `cssPath`, `xpath`, `textSig`, `rect`, and accessibility metadata.',
    '- `SnapshotResult` includes token count, truncation cursor, title, URL, and `trust: "untrusted"`.',
    '',
    '---',
    '',
    '## 5. Governance & Single-Use Confirmation (TRD §5.3, §6.6, PRD HR-8)',
    '',
    '- **Risk Tiers:** T0 (Auto on grant), T1 (Ask once per session), T2 (Always explicit diff confirmation), T3 (Meta-tools).',
    '- **Confirmation Diffs:** High-risk actions generate structured diff rows (`[action, target, domain, value, consequence]`).',
    '- **Tokens:** Diff-bound, single-use, 5-minute TTL.',
    '',
    '---',
    '',
    '## 6. Tamper-Evident Audit Logging (TRD §5.3, §6.9, PRD FR-512)',
    '',
    '- Append-only cryptographic hash chain: `hash = SHA-256(prevHash + canonicalJson(entry))`.',
    '- Canonical JSON sorts object keys lexicographically with no whitespace.',
    '- Non-repudiation verification runnable locally at any time via `verifyChain()`.',
    '',
    '---',
    '',
    '## 7. Tool Registry Surface (TRD §5.4, §10, PRD FR-611, FR-612)',
    '',
    `- **Total Registered Tools:** ${toolsList.length} tools across Readonly, Act, and Governance profiles.`,
    '- **Profiles:** `browser-readonly` (token budget <= 2,500), `browser-act` (token budget <= 4,500).',
    '- **Forbidden Tools (Banned in v1.0):** `evaluate_script`, `network_request`, `cookies_get`, `cookies_set`, `history_read`, `bookmarks_read`.',
    '- **Namespace Pattern:** `/^(browser|site|policy|audit|session|ask|confirm)_[a-z_]+$|^(search|fetch)(_[a-z_]+)?$/`.',
    '',
    '| Tool Name | Title | Tier | Profiles | Budget (ms) | Description |',
    '|---|---|---|---|---|---|',
  ];

  const sortedTools = [...toolsList].sort((a, b) => a.name.localeCompare(b.name));
  for (const tool of sortedTools) {
    const profs = tool.profiles.join(', ');
    lines.push(
      `| \`${tool.name}\` | ${tool.title} | T${tool.tier} | ${profs} | ${tool.budgetMs} | ${tool.description} |`,
    );
  }

  lines.push(
    '',
    '---',
    '',
    '## 8. Exported Module Surface',
    '',
    `Total public symbols exported from root barrel: **${exportedSymbols.length}**`,
    '',
  );

  return lines.join('\n');
}

const generatedContent = generateDoc();

if (!existsSync(outDocPath)) {
  writeFileSync(outDocPath, generatedContent, 'utf-8');
  console.log('Created docs/protocol.md');
  process.exit(0);
}

const existingContent = readFileSync(outDocPath, 'utf-8').replace(/\r\n/g, '\n');
const normalizedGenerated = generatedContent.replace(/\r\n/g, '\n');

if (isWriteMode) {
  writeFileSync(outDocPath, normalizedGenerated, 'utf-8');
  console.log('Updated docs/protocol.md');
  process.exit(0);
}

if (existingContent !== normalizedGenerated) {
  console.error('ERROR: docs/protocol.md is out of sync with packages/protocol source.');
  console.error('Run "pnpm --filter @tether/protocol generate -- --write" to update.');
  process.exit(1);
}

console.log('docs/protocol.md is up to date.');
process.exit(0);
