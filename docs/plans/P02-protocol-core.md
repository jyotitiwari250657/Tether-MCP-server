# Implementation Plan: P02 — packages/protocol Core Contract

**Milestone:** M0 (PRD §16.1, PRD §17, TRD §15 row for HR-4/HR-5)  
**Status:** Completed  
**Document ID:** PLAN-TETHER-P02

---

## 1. Overview and Objectives

P02 expands `@tether/protocol` from a version stub into the complete, frozen contract for Tether (PRD HR-4). This package defines the core wire envelope, typed error codes and actionable hints, accessibility snapshot representation, domain policy and human confirmation decision structures, local tamper-evident audit logging types and cryptographic chaining functions, client pairing and OAuth DTOs, and the initial scaffold for tool registries and profiles.

---

## 2. Files to Create and Modify

### 2.1 Protocol Source Files (`packages/protocol/src/`)
- `envelope.ts`:
  - Wire protocol envelope definitions using Zod discriminated union: `Envelope`, `Req`, `ResOk`, `ResErr`, `Res`, `Evt`.
  - Constants: `MAX_ENVELOPE_BYTES = 900 * 1024` (TRD §5.2, PRD FR-313).
  - Common domain types: `Scope`, `ToolProfile`, `Tier`, `TransportMode`, `Trust`, `GrantLevel`.
  - Events: `EventNames` const array, `EventName` type, forward-compatible `Evt` schema permitting unknown future events.
  - Envelope metadata: `ReqMeta` (chunking, sha256, progressToken).
- `errors.ts`:
  - `ErrorCodes` const array and `ErrorCode` union covering all 17 error codes in TRD §5.5.
  - `ToolError` interface containing `code`, `message`, `hint`, `retryable`, `tier`, `details` (HR-7 sanitized).
  - `HINTS` table matching TRD §5.5 verbatim.
  - `toolError(code, extra)` helper setting standard retryability (`REF_STALE`, `TIMEOUT`, `RATE_LIMITED`, `DEVICE_BUSY`).
- `snapshot.ts`:
  - `Rect` interface (`x`, `y`, `w`, `h`).
  - `RefEntry` interface representing accessible DOM nodes (`ref`, `frame`, `nodeId`, `cssPath`, `xpath`, `role`, `name`, `textSig`, `rect`, `interactive`, `opaque`, `state`).
  - `SnapshotResult` interface (`tree`, `nodes`, `tokens`, `truncated`, `cursor`, `url`, `title`, `trust`, `policyVersion`, `redactionHits`).
- `policy.ts`:
  - `DomainPattern` (`exact` | `wildcard` | `all`).
  - `SensitiveCategory` union covering banking, email, crypto, cloud-console, health, government, credential-form.
  - `PolicyRule` interface (domain match, grant level, session/persistent scope, actor).
  - `DiffRow` and `Decision` interfaces for single-use confirmation diffs (PRD HR-8, FR-507).
- `audit.ts`:
  - `AuditEntry` interface representing append-only hash-chained entries.
  - `canonicalJson(v: unknown): string`: Zero-dependency, RFC 8785-style deterministic JSON serializer (lexicographical key sorting, no whitespace).
  - `hashEntry(e: Omit<AuditEntry, 'hash'>, prevHash: string): Promise<string>`: WebCrypto SHA-256 computation over `prevHash + canonicalJson(entry)`.
  - `verifyChain(entries: AuditEntry[]): Promise<{ ok: boolean; brokenAt?: number }>`: Validates integrity across sequential hash chain entries.
- `pairing.ts`:
  - Shared pairing and OAuth DTOs: `PairBeginRequest`, `PairBeginResponse`, `PairConfirmRequest`, `OAuthClientRegistration`, `TokenResponse`, `OAuthResourceMetadata`, `OAuthAuthorizationServerMetadata`.
- `tools/index.ts`:
  - `ToolSpec<I, O>` interface matching TRD §5.4.
  - `TOOLS`: initially empty `readonly ToolSpec<unknown, unknown>[] = [] as const`.
  - `PROFILES`: `Record<ToolProfile, readonly string[]>`.
  - `FORBIDDEN_TOOLS`: exactly the 6 banned tools from TRD §5.4.
  - `TOOL_NAME_RE`: namespace regex (`/^(browser|site|policy|audit|session|ask|confirm|search|fetch)_[a-z_]+$/`).
  - Helper functions: `isToolAllowed`, `listToolsForProfile`, `tokenBudgetForProfile`.
- `tools/readonly.ts`, `tools/act.ts`, `tools/governance.ts`, `tools/webmcp.ts`:
  - Scaffold files exporting empty typed tool arrays with commented-out examples showing required fields.
- `version.ts`:
  - Preserve `PROTOCOL_VERSION = 1 as const` and `isCompatible(peer: number): boolean` with TRD §5.1 docstrings.
- `index.ts`:
  - Re-export all symbols from the modules above. Retains status as the one permitted barrel file (TRD §4.3.3).

### 2.2 Protocol Test Files (`packages/protocol/test/`)
- `envelope.spec.ts`:
  - Zod validation for `req`, `res` (ok & error), and `evt`.
  - Envelope size cap assertion (`MAX_ENVELOPE_BYTES === 921600`).
  - Forward-compatibility test ensuring unknown `evt` names validate without error.
- `errors.spec.ts`:
  - Verification of `ErrorCodes`, hints completeness, and `toolError()` retryable flag logic.
  - PII/secret leakage heuristic asserting that `details` cannot contain tokens, cards, or emails.
- `audit.spec.ts`:
  - Deterministic serialization test for `canonicalJson` regardless of object key order.
  - 5-entry hash chain creation and verification test.
  - Tamper detection test with mandatory name: `test("PRD FR-512 / TRD §6.9: chain verification detects any byte-level tampering")`.
- `tools.spec.ts`:
  - `test("TRD §5.4 / PRD SEC-03: FORBIDDEN_TOOLS are not present in TOOLS")`.
  - `test("TRD §5.4 / PRD HR-5: every tool name matches TOOL_NAME_RE")`.
  - `test("TRD §11 NFR-110 / PRD FR-612: token budgets enforced on built profiles")` using the byte-count token heuristic.
- `version.spec.ts`:
  - Updated to prevent any regressions on `PROTOCOL_VERSION` and `isCompatible`.

### 2.3 Documentation and Generation Scripts
- `scripts/generate-protocol-docs.mjs`:
  - Node script using the TypeScript compiler API to inspect `packages/protocol/src/` and emit `docs/protocol.md`.
  - Formatted with `<!-- GENERATED — DO NOT EDIT -->` header.
  - Supports diff verification: exits non-zero if `docs/protocol.md` deviates from source when run in check mode.
- `docs/protocol.md`:
  - Committed generated Markdown documentation.
- `packages/protocol/package.json`:
  - Add `typescript: ^5.7.3` under `devDependencies`.
  - Update `"generate"` script to run `node ../../scripts/generate-protocol-docs.mjs`.

---

## 3. Acceptance Criteria Verification Strategy

| Criterion | Requirement | Verification Method |
|---|---|---|
| **AC-P02-01** | `pnpm install --frozen-lockfile` succeeds | Run `pnpm install` then `pnpm install --frozen-lockfile`. |
| **AC-P02-02** | `pnpm typecheck` zero errors workspace-wide | Execute `pnpm typecheck` across all packages. |
| **AC-P02-03** | `pnpm lint` zero errors | Execute `pnpm lint` (`biome check .`). |
| **AC-P02-04** | `pnpm build` dist artifacts | Verify `.js`, `.d.ts`, and `.d.ts.map` for every module in `packages/protocol/dist`. |
| **AC-P02-05** | `pnpm run test -- --coverage` >= 95% coverage | Run test suite with V8 coverage reporter on `packages/protocol/src`. |
| **AC-P02-06** | `check-forbidden-apis.mjs` exits 0 | Execute forbidden API scanner across the repository. |
| **AC-P02-07** | `check-traceability.mjs` exits 0 with increased coverage | Run traceability scanner and check increase in referenced IDs. |
| **AC-P02-08** | `FORBIDDEN_TOOLS` absence test passes | Run `tools.spec.ts` asserting no forbidden tools in `TOOLS`. |
| **AC-P02-09** | Token budget test passes with empty tools | Run `tools.spec.ts` asserting token budget constraint. |
| **AC-P02-10** | Protocol doc generation committed-ready | Run `pnpm --filter @tether/protocol generate` and verify `docs/protocol.md`. |
| **AC-P02-11** | Doc generator fails on manual edits | Delete a line in `docs/protocol.md`, run generator check (assert exit 1), then restore (assert exit 0). |
| **AC-P02-12** | Chain tamper test present and passes | Verify presence and execution of `PRD FR-512 / TRD §6.9: chain verification detects any byte-level tampering`. |
| **AC-P02-13** | File size <= 300 lines in `packages/protocol/src` | Measure line counts of all TS files in `packages/protocol/src/`. |
| **AC-P02-14** | Dependency allowlist adherence | Verify only `typescript` was added to `packages/protocol/package.json` devDependencies. |
| **AC-P02-15** | Full chain command passes end to end | Run `cmd /c "pnpm install && pnpm typecheck && pnpm lint && pnpm build && pnpm test && pnpm check"`. |

---

## 4. Execution Sequence

1. Author all protocol modules in `packages/protocol/src/` (`envelope.ts`, `errors.ts`, `snapshot.ts`, `policy.ts`, `audit.ts`, `pairing.ts`, `tools/index.ts`, `tools/readonly.ts`, `tools/act.ts`, `tools/governance.ts`, `tools/webmcp.ts`, `index.ts`).
2. Add unit tests in `packages/protocol/test/` (`envelope.spec.ts`, `errors.spec.ts`, `audit.spec.ts`, `tools.spec.ts`, and update `version.spec.ts`).
3. Add `typescript` devDependency to `packages/protocol/package.json` and install.
4. Implement `scripts/generate-protocol-docs.mjs` and emit `docs/protocol.md`.
5. Run linting and formatting via Biome.
6. Verify all acceptance criteria and record command outputs.
