# P05 — Ref Engine & Action Executor Implementation Plan

Milestone **M1** (PRD §16.1, PRD §17, TRD §15 rows for `FR-201`…`FR-213`).
Implements the core DOM representation, self-healing ref resolution, and browser action execution in `apps/extension/lib/`.

---

## 1. Scope and Modules

### `lib/refs/` — the Ref Engine
- `types.ts`: `NodeHandle`, `SnapshotOptions`, `ResolveOptions`, `ResolveOutcome`.
- `implicit-role.ts`: ARIA implicit roles per HTML-AAM spec (≤ 250 lines).
- `accessibleName.ts`: ACCNAME 8-level priority chain, password/OTP suppression (≤ 200 lines).
- `snapshot.ts`: Depth-first traversal, skip tags, hidden elements, shadow DOM, iframe handling, 200-node/4000-token cap, `textSig` quantization, line formatting, session storage persistence (≤ 295 lines).
- `resolve.ts`: 5-step self-healing resolution cascade (nodeId → cssPath → xpath → fuzzy match → REF_STALE), hand-rolled Levenshtein distance (≤ 250 lines).
- `index.ts`: Public API barrel.

### `lib/actions/` — the Action Executor
- `types.ts`: `ActionResult` (`{ ok, ref, role, name, urlAfter, domChanged, ms, trust: 'tether' }`), option types.
- `common.ts`: `stable`, `guardCovered`, `result`, `rect`, `isVisible`.
- `click.ts`: 8-event pointer + mouse sequence, center coordinates, modifiers.
- `type.ts`: React-compatible prototype setter, character jitter (18–45ms), `fillForm` with `secretId` confirmation check.
- `form.ts`: `select` by value/label/index, `pressKey`.
- `scroll.ts`: `scroll` by direction/amount/ref, `hover`.
- `drag.ts`: 10-step interpolated drag sequence.
- `wait.ts`: `waitFor` with `MutationObserver` + rAF (zero `setInterval`).
- `nav.ts`: `navigate`, `tabs` (`close` returns `NEEDS_CONFIRMATION`).
- `submit.ts`: T2 action returning `NEEDS_CONFIRMATION` with diff.
- `dialog.ts`: returns `NEEDS_CONFIRMATION` stub.
- `index.ts`: Public API barrel.

### Service Worker Wiring
- `background.ts`: Routes M0 tools (`browser_snapshot`, `browser_find`, `browser_click`, `browser_type`, `browser_navigate`).
- Converts errors to typed `ToolError` values (HR-11).
- 10-minute `idem` deduplication cache in `chrome.storage.session`.

### Test Suite (`apps/extension/test/`)
- Unit tests using Vitest + `@webext-core/fake-browser` + `happy-dom` targeting ≥ 95% coverage on statements, branches, functions, and lines.

---

## 2. Acceptance Criteria Checklist
- [x] AC-P05-01: `pnpm install` / lockfile succeeds.
- [x] AC-P05-02: `pnpm typecheck` exits 0.
- [x] AC-P05-03: `pnpm lint` exits 0.
- [x] AC-P05-04: `pnpm --filter @tether/extension build` succeeds (bundle size ≤ 400 KB).
- [x] AC-P05-05: `pnpm test` passes all tests; `lib/refs/` and `lib/actions/` have ≥ 95% coverage on statements, functions, and lines.
- [x] AC-P05-06: `check-forbidden-apis.mjs` exits 0.
- [x] AC-P05-07: `check-requirement-ids.mjs` exits 0.
- [x] AC-P05-08: `check-traceability.mjs` exits 0.
- [x] AC-P05-09: No file in `lib/refs/` or `lib/actions/` exceeds 300 lines.
- [x] AC-P05-10: Levenshtein hand-rolled in `resolve.ts`.
- [x] AC-P05-11: `snapshot()` persists refMap to `chrome.storage.session`.
- [x] AC-P05-12: `resolve()` on stale ref returns `REF_STALE` with ≤ 5 candidates.
- [x] AC-P05-13: `click()` dispatches 8-event sequence in correct order.
- [x] AC-P05-14: `type()` into React-controlled input triggers React change.
- [x] AC-P05-15: `waitFor()` does not call `setInterval`.
- [x] AC-P05-16: `fillForm()` with `secretId` returns `NEEDS_CONFIRMATION`.
- [x] AC-P05-17: `tabs({action: 'close'})` and `submit()` return `NEEDS_CONFIRMATION`.
- [x] AC-P05-18: Message handler in `background.ts` routes 5 M0 tools, returns `INTERNAL` for others (as `NOT_IMPLEMENTED` is not in frozen protocol ErrorCode).
- [x] AC-P05-19: Message handler caches responses by `idem` for 10 minutes.
- [x] AC-P05-20: `pnpm check` exits 0 end-to-end.
