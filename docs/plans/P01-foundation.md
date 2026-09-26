# Implementation Plan: P01 — Repository Foundation

**Milestone:** M0 (PRD §16.1, PRD §17)  
**Status:** In Progress  
**Document ID:** PLAN-TETHER-P01

---

## 1. Overview and Objectives

This plan details the implementation of Prompt 01 (**P01 — Repository Foundation**) for **Tether**, a governed browser-control connector. P01 establishes the foundational monorepo configuration, governance documents, protocol package stub, CI pipeline, and automated check scripts enforcing the product's hard rules and architectural constraints.

---

## 2. Files to Create

### 2.1 Root Tooling and Monorepo Configuration
- `package.json` — Monorepo root definition (`private: true`, `packageManager: pnpm@9.15.4`, `engines: node >=20`, dependency allowlist devDependencies only, scripts per TRD §4.2 with unimplemented targets printing clear skip notices).
- `pnpm-workspace.yaml` — Workspace package globs (`packages/*`, `apps/*`).
- `turbo.json` — Turborepo task pipeline configuration (`build`, `typecheck`, `lint`, `test`, `generate`).
- `tsconfig.base.json` — Strict compiler options per TRD §4.3.1 (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `module: ESNext`, `moduleResolution: bundler`, `target: ES2022`, `verbatimModuleSyntax`, `declaration`, `declarationMap`, `sourceMap`).
- `tsconfig.json` — Root project reference tsconfig referencing packages.
- `biome.json` — Linter and formatter rules enforcing line width 100, banning default exports, banning `eval`/`new Function`, banning `dangerouslySetInnerHTML`.
- `knip.json` — Unused code/export scanner configuration.
- `vitest.config.ts` — Root test configuration with coverage reporter via `@vitest/coverage-v8`.
- `.nvmrc` — Node.js version pinning (`20`).
- `.gitignore` — Ignore build artifacts, caches, env secrets, test results, OS files.
- `.editorconfig` — Consistent 2 spaces, UTF-8, LF, final newline, trim whitespace.
- `LICENSE` — MIT License with required open-core TODO header comment.
- `README.md` — Product one-liner, current status, PRD/TRD/AGENTS/THREAT_MODEL links, PRD §7.2 three modes table, and P01–P25 build status table.
- `PRD.md` and `TRD.md` — Root copies of governing documents per TRD §4.1 directory tree.

### 2.2 Governance Documents
- `AGENTS.md` — Agent instructions containing PRD §0, PRD §4 HR-1…HR-14 in full, PRD §3.2 NG-1…NG-12 in full, TRD §2.3 single point of policy invariant, TRD §4.3 coding standards 1–10, TRD §4.1 directory tree, TRD §3 dependency table, TRD Appendix D checklist, and document reference order.
- `PERMISSIONS.md` — CI gate rule, Table 1 (permitted permissions: 8 from FR-102 + 4 optional permissions with justification, why least-privileged alternative fails, and first milestone needed), and Table 2 (8 forbidden permissions from FR-103 with rationales).
- `THREAT_MODEL.md` — All 14 rows of TRD §10.2 (SEC-01…SEC-14) with threat, 2–4 sentence attack narrative, PRD/TRD controls, implementing modules, test files, and honest residual risks (including screenshot-redaction-without-OCR and vault in-memory plaintext), plus PleaseFix context and test methodology.
- `SECURITY.md` — Disclosure policy, 72h critical-fix SLA (PRD MET-23), bounty scope, out of scope, reporting instructions, zero-plaintext-at-rest declaration (PRD PRV-03).

### 2.3 `packages/protocol` (Stub Only)
- `packages/protocol/package.json` — `@tether/protocol` package metadata, `type: module`, main/types dist points, exports map, scripts (`build`, `test`, `generate`, `typecheck`), and dependencies strictly limited to `zod` and `zod-to-json-schema`.
- `packages/protocol/tsconfig.json` — Extends `../../tsconfig.base.json`, `rootDir: src`, `outDir: dist`.
- `packages/protocol/src/version.ts` — `PROTOCOL_VERSION = 1 as const`, `isCompatible(peer: number): boolean`, and TRD §5.1 compatibility rule docstrings.
- `packages/protocol/src/index.ts` — Sole permitted barrel file, re-exporting `version.ts`, with comments listing modules to be added in P03.
- `packages/protocol/test/version.spec.ts` — Vitest unit tests citing TRD §5.1 / PRD HR-5 verifying protocol version and compatibility logic.
- `packages/protocol/README.md` — Documentation stating frozen contract invariants (PRD HR-4).

### 2.4 Placeholder Directories (README.md Only)
- `apps/extension/README.md` (Implemented in P04)
- `apps/daemon/README.md` (Implemented in P07)
- `apps/relay/README.md` (Implemented in P14)
- `apps/web/README.md` (Implemented in P19)
- `packages/redact/README.md` (Implemented in P05)
- `packages/keyring/README.md` (Implemented in P07)
- `packages/eval/README.md` (Implemented in P12)

### 2.5 CI and Check Scripts
- `.github/workflows/ci.yml` — Multi-stage GitHub Actions workflow implementing TRD Appendix C: static, forbidden, test (matrix ubuntu/macos/windows), and disabled `e2e` (`if: false` with comment `# enabled in P09`).
- `scripts/check-bundle-size.mjs` — Scans `apps/extension/.output/**`, enforces 400 KB uncompressed limit (TRD §11, ADR S8), exits 0 with skip message if output directory absent.
- `scripts/check-forbidden-apis.mjs` — Scans `packages/**/src` and `apps/**/src` for forbidden tokens (`eval(`, `new Function(`, `Function(`, dynamic non-literal `import(`, `document.write`, `chrome.cookies`, `chrome.webRequest`, `chrome.debugger`, remote `<script src="http...>`). Exits 1 with diagnostic on hit; exits 0 if clean.
- `scripts/check-manifest-permissions.mjs` — Compares `apps/extension/manifest*.json` against `PERMISSIONS.md` Table 1 and Table 2. Exits 0 with skip message if manifest absent.
- `scripts/check-store-schema.mjs` — Scans `apps/relay/migrations/**.sql` for sensitive column names not in allowlist. Exits 0 with skip message if migrations absent.
- `scripts/check-traceability.mjs` — Parses requirement IDs from PRD/TRD, greps codebase and test files, writes `docs/traceability.md`, supports `--strict`. Exits 0 with warning summary in P01.
- `docs/README.md` — Documents generated artifacts (`protocol.md`, `traceability.md`, `openapi.relay.yaml`) and hand-editing prohibition.

---

## 3. Acceptance Criteria Verification Strategy

| Criterion | Requirement | Verification Method |
|---|---|---|
| **AC-P01-01** | `pnpm install --frozen-lockfile` succeeds | Generate lockfile via `pnpm install`, then execute `pnpm install --frozen-lockfile`. |
| **AC-P01-02** | `pnpm typecheck` zero errors | Execute `pnpm typecheck` via Turborepo across workspaces. |
| **AC-P01-03** | `pnpm lint` zero errors/warnings | Execute `pnpm lint` (`biome check .`). |
| **AC-P01-04** | `pnpm build` produces protocol dist files | Execute `pnpm build` and verify `packages/protocol/dist/` contains `.js`, `.d.ts`, and `.d.ts.map`. |
| **AC-P01-05** | `pnpm test` passes with 100% version.ts coverage | Run `pnpm test -- --coverage` and verify 100% statements, branches, functions, and lines. |
| **AC-P01-06** | `check-forbidden-apis.mjs` passes clean & detects eval | Run on tree (exit 0); inject temp file with `eval("malicious")` and assert exit 1; delete temp file. |
| **AC-P01-07** | Non-existent target check scripts skip cleanly | Execute bundle size, manifest permissions, and store schema scripts; verify exit 0 with skip logs. |
| **AC-P01-08** | `check-traceability.mjs` generates `docs/traceability.md` | Run script, verify table and summary output, check exit code 0. |
| **AC-P01-09** | `AGENTS.md` content completeness | Confirm all 14 HR rules, 12 NG items, TRD §2.3 invariant, 10 coding standards, Appendix D checklist. |
| **AC-P01-10** | `PERMISSIONS.md` content completeness | Confirm Table 1 (8 FR-102 + 4 optional) and Table 2 (8 FR-103 forbidden). |
| **AC-P01-11** | `THREAT_MODEL.md` content completeness | Confirm 14 SEC rows, 7 fields each, screenshot and vault residual risks, PleaseFix context. |
| **AC-P01-12** | `.github/workflows/ci.yml` validity | Verify YAML syntax and disabled `e2e` job referencing P09. |
| **AC-P01-13** | File size <= 300 lines limit | Execute line-count check across all source and config files to assert <= 300 lines. |
| **AC-P01-14** | Dependency allowlist adherence | Inspect all `package.json` files to verify only allowlisted packages exist. |
| **AC-P01-15** | Full verification command chain | Run `pnpm install && pnpm typecheck && pnpm lint && pnpm build && pnpm test && pnpm check` to exit 0. |

---

## 4. Execution Sequence

1. Create root configuration files (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `tsconfig.json`, `biome.json`, `knip.json`, `vitest.config.ts`, `.nvmrc`, `.gitignore`, `.editorconfig`, `LICENSE`, `README.md`).
2. Sync `PRD.md` and `TRD.md` to repository root.
3. Author governance documents (`AGENTS.md`, `PERMISSIONS.md`, `THREAT_MODEL.md`, `SECURITY.md`).
4. Construct `packages/protocol` stub (`package.json`, `tsconfig.json`, `version.ts`, `index.ts`, `test/version.spec.ts`, `README.md`).
5. Establish placeholder directories (`apps/extension`, `apps/daemon`, `apps/relay`, `apps/web`, `packages/redact`, `packages/keyring`, `packages/eval`).
6. Implement CI workflow and the 5 check scripts (`scripts/*.mjs`, `.github/workflows/ci.yml`, `docs/README.md`).
7. Execute dependency installation (`pnpm install`) and generate frozen lockfile.
8. Execute all verification steps, run negative tests, measure coverage, and compile the final report.
