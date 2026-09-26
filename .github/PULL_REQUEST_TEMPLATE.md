<!--
  Before opening: read AGENTS.md (hard rules HR-1..HR-14 apply to every change)
  and CONTRIBUTING.md (process). Every test name must cite a PRD/TRD ID.
-->

## Summary

What does this PR change, and why? Link the issue:
Closes #

## Requirement IDs

Which PRD/TRD IDs does this implement or touch? (e.g. `FR-207`, `HR-10`, `TRD §6.5`)

- …

## Acceptance criteria

Cite the ACs verified and how (test names count).

- …

## Gate list (docs/RELEASE.md §1 — all must pass)

Run locally before requesting review; CI enforces the same list.

- [ ] `pnpm typecheck` — exit 0
- [ ] `pnpm lint` — exit 0
- [ ] `pnpm run test -- --coverage` — 0 failures
- [ ] `pnpm test:e2e` — green (user-facing changes)
- [ ] `pnpm run check` — exit 0 (forbidden APIs, permissions, bundle, traceability)

## Checklist

- [ ] No file exceeds 300 lines (TRD §4.3).
- [ ] No new dependency outside the allowlist.
- [ ] No permission added without a PERMISSIONS.md justification (HR-3).
- [ ] Page-derived data carries `trust: "untrusted"` (HR-6).
- [ ] I did **not** bump versions — maintainers cut releases.
