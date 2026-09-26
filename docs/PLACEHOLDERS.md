# Placeholder & Contact Inventory (Prompt 13, AC-P13-05)

Every occurrence below must be resolved by a human before or immediately after the
public push. Regenerate with `node scripts/set-repo-url.mjs --dry-run` after edits.

Legend: **[URL]** = canonical repo/web URL (rewrite with `scripts/set-repo-url.mjs`)
· **[EMAIL]** = contact placeholder · **[ASSET]** = demo asset placeholder · **[SPEC]** =
intentional future endpoint inside PRD/TRD specs — no action needed for release.

| # | File:Line | Kind | Current value | Action required |
|---|---|---|---|---|
| 1 | README.md:32 | [URL] | `https://github.com/tether-ai/tether.git` | Confirm final `owner/repo`, then `node scripts/set-repo-url.mjs --url <url>` |
| 2 | CONTRIBUTING.md:66 | [URL] | `https://github.com/tether-ai/tether.git` | Same rewrite as #1 (script covers both) |
| 3 | README.md:5 | [ASSET] | ~~`hero-placeholder.svg`~~ → ~~`hero.svg`~~ → **RESOLVED** (14-FIX-01): `docs/assets/hero.png` — raster-derived lockup from `brand/logo-ref.jpg`; regenerate with `node scripts/compose-brand-assets.mjs` | None — re-run the derivation script only if the source raster changes |
| 4 | README.md:49 | [ASSET] | ~~`demo-placeholder.svg`~~ → **RESOLVED**: real `docs/assets/demo.gif` captured via `scripts/make-demo-gif.ts` (160 KB, 20 frames) | None — re-record after UI changes with `pnpm exec tsx scripts/make-demo-gif.ts` |
| 5 | SECURITY.md:18 | [EMAIL] | `security@<YOUR-DOMAIN>` | Configure & verify a mailbox you own, or delete the optional email bullet (GHSA is sufficient alone) |
| 6 | docs/PRD.md:368 | [SPEC] | `https://mcp.tether.dev/mcp` (FR-605) | None for release — future hosted-relay endpoint, not a contact |
| 7 | docs/TRD.md:1100,1175,1195,1203,1205 | [SPEC] | `*.tether.dev` endpoints | None for release — same rationale as #6 |
| 8 | CONTRIBUTING.md (CoC section) | [URL] | `contributor-covenant.org` external link | None — stable external URL |

No other placeholder URLs (`<org>`, `YOUR_ORG`), dead emails, or TBD contacts exist in
`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/*.md`, or `apps/web/src/**`
(audited 2026-09-26; re-audit with the grep patterns in `scripts/set-repo-url.mjs`).
