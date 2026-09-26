# Tether Documentation

This directory contains product documentation and generated specifications.

---

## Governing Documents (Normative)

- [`PRD.md`](file:///c:/Users/acer/Desktop/Tether/PRD.md) — Product Requirements Document (PRD-TETHER-001 v1.0.0)
- [`TRD.md`](file:///c:/Users/acer/Desktop/Tether/TRD.md) — Technical Requirements Document (TRD-TETHER-001 v1.0.0)

---

## Generated Artifacts (DO NOT HAND-EDIT)

The following files are mechanically generated during the build and check pipelines:

1. `protocol.md`: Generated from `@tether/protocol` via `pnpm --filter @tether/protocol generate`.
2. `traceability.md`: Generated from requirements cross-referencing via `pnpm trace` (`node scripts/check-traceability.mjs`).
3. `openapi.relay.yaml`: Generated from the relay router specifications for OAuth & connector directory audits.

Any manual modifications to these files will be overwritten in CI.
