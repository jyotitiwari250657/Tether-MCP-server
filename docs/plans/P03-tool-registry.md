# Implementation Plan: P03 — Tool Registry & Prerequisite Cleanup

**Milestone:** M0/M1 (PRD §16.1, PRD §17, TRD §15)  
**Status:** Completed  
**Document ID:** PLAN-TETHER-P03

---

## 1. Overview and Objectives

P03 implements the complete, normative tool registry in `@tether/protocol` for Tether.
It performs two prerequisite cleanups:
1. Verifies the absolute removal of any reference to `power-pack` or fabricated requirement IDs (such as `FR-613`), enforcing the strict two-profile model: `browser-readonly` and `browser-act` (PRD FR-611).
2. Achieves 100% statement, branch, function, and line coverage (target ≥ 95%) across all protocol source files.

It then defines all 40 core tools across Readonly (R01–R10), Act (A01–A17, split into 5 sub-modules to respect the 300-line cap per TRD §4.3.2), and Governance (G01–G08) profiles, strictly constrained to token budgets (≤ 2,500 tokens for `browser-readonly`, ≤ 4,500 tokens for `browser-act` per PRD FR-612 / TRD §11 NFR-110).

---

## 2. Prerequisite Cleanups

### 2.1 Profile Sanitization (PRD FR-611)
- Ensure `ToolProfile = 'browser-readonly' | 'browser-act'`.
- Ensure `PROFILES` only maps `'browser-readonly'` and `'browser-act'`.
- Verified: Zero matches for `power-pack`, `powerPack`, or `FR-613` in the workspace.

### 2.2 Coverage Elevation (TRD §13, AC-P03-02)
- Added branch test cases in `packages/protocol/test/audit.spec.ts` for negative zero, `false`, sparse arrays, and undefined values in arrays.
- Verified: Coverage on `packages/protocol/src/` is **100% Statements, 100% Branches, 100% Functions, 100% Lines**.

---

## 3. Files to Create and Modify

### 3.1 Act Sub-Modules (`packages/protocol/src/tools/`)
- `act_click.ts` — A02 (`browser_click`), A07 (`browser_scroll`), A08 (`browser_hover`), A09 (`browser_drag`) [4 tools].
- `act_input.ts` — A03 (`browser_type`), A04 (`browser_fill_form`), A05 (`browser_select`), A06 (`browser_press_key`), A16 (`browser_type_secret`) [5 tools].
- `act_nav.ts` — A01 (`browser_navigate`), A10 (`browser_wait_for`), A11 (`browser_tabs`) [3 tools].
- `act_submit.ts` — A12 (`browser_submit`), A13 (`browser_dialog`), A14 (`browser_download`), A15 (`browser_upload`) [4 tools].
- `act_task.ts` — A17 (`browser_task_start`, `browser_task_status`) [2 tools].
- `act.ts` — Concatenates and exports `ACT_TOOLS` (18 tools total).

### 3.2 Readonly, Governance, and WebMCP (`packages/protocol/src/tools/`)
- `readonly.ts` — R01 (`browser_snapshot`), R02 (`browser_get_text`), R03 (`browser_screenshot`), R04 (`browser_list_tabs`), R05 (`browser_find`), R06 (`browser_read_console`), R07 (`browser_list_network`), R08 (`browser_extract`), R09 (`search`), R10 (`fetch`) [10 tools].
- `governance.ts` — G01 (`policy_get`), G02 (`policy_grant`), G03 (`policy_revoke`), G04 (`ask_user`), G05 (`confirm_action`), G06 (`session_pause`, `session_resume`, `session_abort`, `session_status`), G07 (`audit_export`) [10 tools].
- `webmcp.ts` — G08 (`site_tools_list`, `site_tools_call`) [2 tools].

### 3.3 Registry Integration & Tool Specification (`packages/protocol/src/tools/index.ts`)
- Populate `TOOLS` array concatenating `READONLY_TOOLS`, `ACT_TOOLS`, `GOVERNANCE_TOOLS`, and `WEBMCP_TOOLS` (40 tools total).
- Adjust `TOOL_NAME_RE` to `/^(browser|site|policy|audit|session|ask|confirm)_[a-z_]+$|^(search|fetch)$/` to accommodate PRD §10.2 tool names `search` and `fetch`.
- Implement `tokenBudgetForProfile` using the JSON Schema stringify length heuristic `Math.ceil(JSON.stringify(spec).length / 4)`.

### 3.4 Verification & Validation Scripts
- `scripts/check-requirement-ids.mjs`: Script to verify that all cited requirement IDs exist in `PRD.md` or `TRD.md`.
- `package.json`: Wire `check-requirement-ids.mjs` into `pnpm check`.

### 3.5 Test Suite Updates (`packages/protocol/test/`)
- `test/tools.spec.ts`:
  - Assert `TOOLS.length === 40` (AC-P03-04).
  - Assert all T2 tools declare `requires.confirm === true` (AC-P03-05).
  - Assert all tool descriptions ≤ 150 chars (AC-P03-06).
  - Assert all field descriptions ≤ 80 chars (AC-P03-07).
  - Assert `browser-readonly` token count ≤ 2,500 and `browser-act` token count ≤ 4,500 (AC-P03-08).
  - Assert absence of `FORBIDDEN_TOOLS` (AC-P03-09).
  - Assert `TOOL_NAME_RE` match for all 40 tools (AC-P03-10).

---

## 4. Acceptance Criteria Checklist

- [x] AC-P03-01: Remove unauthorised `power-pack` and `FR-613`. `ToolProfile` is strictly `'browser-readonly' | 'browser-act'`.
- [x] AC-P03-02: Branch coverage on `packages/protocol/src/` is ≥ 95% (all four metrics ≥ 95% — achieved 100%).
- [x] AC-P03-03: All 40 tools present in `TOOLS` with schemas, annotations, tiers, profile membership, budgetMs ≤ 30,000.
- [x] AC-P03-04: `TOOLS.length === 40` asserted by a test.
- [x] AC-P03-05: Every T2 tool has `requires.confirm: true`.
- [x] AC-P03-06: No tool description longer than 150 chars.
- [x] AC-P03-07: No schema field description longer than 80 chars.
- [x] AC-P03-08: Token budget tests pass: `browser-readonly` ≤ 2,500 tokens (2,433), `browser-act` ≤ 4,500 tokens (4,279).
- [x] AC-P03-09: No tool in `TOOLS` has a name in `FORBIDDEN_TOOLS`.
- [x] AC-P03-10: Every tool name matches `TOOL_NAME_RE`.
- [x] AC-P03-11: `act.ts` split into 5 sub-modules ≤ 300 lines; no barrel files.
- [x] AC-P03-12: `docs/protocol.md` regenerated listing all 40 tools with `<!-- GENERATED — DO NOT EDIT -->`.
- [x] AC-P03-13: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` pass.
- [x] AC-P03-14: `pnpm check` exits 0 end to end.
- [x] AC-P03-15: No file in `packages/protocol/src/` exceeds 300 lines.
- [x] AC-P03-16: `scripts/check-requirement-ids.mjs` validates zero fabricated IDs and is wired into `pnpm check`.
