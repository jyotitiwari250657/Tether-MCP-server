# RELEASE.md — Tether release engineering (TRD §13, PRD §16, FR-801…FR-807)

Applies to **v0.1.0 (beta)** and every later release. Gates are enforced locally/CI; the
human steps at the end cannot be automated.

---

## 1. Pre-flight gate list (all must pass before any upload)

Run in order; each command must exit 0.

| # | Gate | Command | Source |
|---|---|---|---|
| 1 | Types + lint | `pnpm typecheck && pnpm lint` | NFR-401 |
| 2 | Unit suite | `pnpm run test -- --coverage` (0 failures; ≥ 80 % on NFR-402 modules) | NFR-402 |
| 3 | E2E scenarios | `pnpm test:e2e` (9 scenario specs green, headed Chrome) | TRD §12.2 |
| 4 | **Live eval ≥ 70 %** | `pnpm eval -- --live` (published metric; v0.1.0 = 100 %, 50/50) | NFR-201 |
| 5 | Bundle budget | `pnpm --filter @tether/extension build && node scripts/check-bundle-size.mjs` (warn > 380 KB, fail > 400 KB) | TRD §11 |
| 6 | Traceability | `pnpm trace` (report regenerated; new P0 IDs must be covered) | NFR-403 |
| 7 | Compliance sweep | `pnpm check` (forbidden APIs, manifest/permissions, relay schema, requirement IDs, directory report) | HR-1, HR-3 |
| 8 | Packaging | `pnpm package-release` → `release/manifest.json` with SHA-256 per artifact | FR-801 |

A release may not be cut with any gate red. If gate 4 is between 70 % and the previous
release's rate, ship only with a written regression analysis in the changelog.

## 2. Semver rules (TRD §13.3)

- One version number across all artifacts (extension, daemon, relay), read from the root
  `package.json` by `scripts/package-release.ts`.
- Breaking wire changes bump `PROTOCOL_VERSION` (`packages/protocol`) — **never after the
  M4 public launch** (frozen-snapshot clients, HR-5).
- Store submissions are monotonic: the CWS rejects uploads whose version ≤ the last
  published one; rollback republishes `previous + 0.0.1` (see §4).
- Pre-1.0: breaking changes may land as minor bumps (0.x.y); this ends at 1.0.0.

## 3. Staged rollout procedure (FR-804)

1. Upload the new zip to the CWS dashboard item → submit for review (unlisted item).
2. After approval, publish at **10 %** of users. Monitor for 24–48 h:
   - CWS crash/ANR telemetry, support inbox, GitHub issues labelled `release-blocker`.
3. If clean → 50 % → 24 h → 100 %.
4. A release-blocker at any step → halt the rollout (§4) — do not "fix forward" past users.
5. Daemon releases ride the same cadence: `latest.json` on the download host is repointed
   only after the matching extension stage succeeds (auto-update verifies SHA-256 + Ed25519
   before swap, FR-314/FR-805).

## 4. Rollback per artifact

| Artifact | Procedure |
|---|---|
| Extension | Halt the staged rollout in the dashboard. Re-publish the previous build under version `previous + 0.0.1` (forward-only store). Users on the bad version update within hours; no server-side kill switch exists for the extension itself — use the in-product kill switch messaging if the defect is behavioural. |
| Daemon | Repoint `latest.json` to the previous release record. Compiled binaries self-rollback on failed health check (FR-314). Node fallback users pin the npm version: `npm i -g @tether/daemon@<prev>`. |
| Relay | `wrangler rollback` to the previous Worker version. D1 migrations are forward-only — ship a compensating migration, never a down-migration. Self-hosted Workers pin their own deploy; publish the incident note to `/status`. |
| Store listing | Listing copy/metadata regressions: revert the draft, re-submit; review queue applies (plan ≥ 1 day). |

## 5. Release signing notes

- Extension: `wxt zip` output is uploaded as-is; the CWS signs at distribution time. Keep
  the pinned key (FR-104) — losing it changes the extension ID and breaks native-messaging
  `allowed_origins` and every installed daemon config.
- Daemon binaries (when built with bun): sign per-OS — macOS notarised `.pkg`/`.dmg`
  (Apple Developer ID + notarisation), Windows Authenticode-signed NSIS, Linux `.deb`/`.rpm`
  GPT-GPG signatures. Publish `latest.json` + Ed25519 signature beside the binaries; the
  updater refuses unsigned or hash-mismatched swaps (FR-314, FR-805).
- `release/manifest.json` records SHA-256 for every artifact. The whole `release/` directory
  is gitignored (manifest included); regenerate it with `pnpm package-release` and verify
  before upload:
  `node -e "…"` snippet in `docs/BETA-LAUNCH.md`. A mismatch means the artifact was rebuilt
  or tampered — do not upload; repackage.

## 6. Human-only steps (cannot be automated)

- CWS publisher account, US$5 fee, DSA trader/identity verification (day 1).
- Edge Add-ons account + re-submission (FR-803).
- Anthropic/OpenAI directory accounts, domain verification, directory review waits.
- Privacy policy + retention + threat-model pages live at the production domain (FR-806).
- Bug bounty programme live before public listing (CMP-06).
