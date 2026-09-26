# @tether/protocol — The Frozen Contract

### Document ID: SPEC-PROTOCOL-001 · Milestone: M0+ (PRD HR-4, TRD §5)

`@tether/protocol` is the single source of truth for all wire types, envelope discriminators, tool schemas, policy rules, and error codes in Tether.

---

## Invariants

1. **Single Protocol Definition (PRD HR-4):** All wire types, tool schemas, and error codes live in `packages/protocol`. No other package or application may redefine them.
2. **Additive-Only Schemas (PRD HR-5):** Once published, tool names, existing fields, and semantics are immutable. New fields must be optional.
3. **Generated Documentation:** `docs/protocol.md` is strictly generated from this package via `pnpm --filter @tether/protocol generate`. It must never be manually edited.
