# AGENTS.md — Agent Operating Rules and System Invariants

> **Reference order:** `PRD.md §4 → PRD.md §9/§10 → TRD.md → AGENTS.md`

This document is the normative operational guide for every agent turn in this repository.
Before writing any code or proposing changes, read this document in full.

---

## 0. HOW TO USE THE GOVERNING DOCUMENTS (PRD §0)

1. **This PRD is normative.** Words carry RFC-2119 force: **MUST / MUST NOT** are hard requirements;
   **SHOULD** is a strong default that may be deviated from only with a written justification in the
   response; **MAY** is optional.
2. **Every requirement has a stable ID** (`FR-101`, `NFR-204`, `SEC-07`, `TOOL-A14`, `AC-…`).
   When you implement, cite the ID in your code comments, commit messages, and test names.
   Format: `// FR-204: self-healing ref resolution` and `test("FR-204 resolves via textSig when nodeId detaches")`.
3. **§4 HARD RULES are inviolable.** Violating any of them is a defect regardless of whether tests pass.
   If a task appears to require a violation, do not implement it — report the conflict.
4. **§3 NON-GOALS are as binding as the goals.** Do not build anything listed there, do not add
   dependencies for it, do not "future-proof" for it.
5. **Priority governs order of work:** `P0` = v1.0 blocker · `P1` = must ship within 2 releases ·
   `P2` = backlog. Never build a P2 while a P0 is incomplete unless explicitly instructed.
6. **Acceptance criteria are the contract.** A requirement is not "done" when code exists; it is done
   when every AC under it is demonstrably true. End each implementation response with a checklist of
   the ACs you verified and the ACs you did **not** verify.
7. **Traceability:** §17 maps milestones → requirement IDs. Before starting any task, confirm which
   milestone it belongs to and whether its prerequisites are complete.
8. **Platform facts in §12 were verified in September 2026.** They are constraints, not assumptions.
   If you believe one is stale, flag it — do not silently design around a different value.
9. **When ambiguous:** prefer the interpretation that (a) reduces permission scope, (b) increases user
   control, (c) reduces what leaves the user's machine. That ordering is the product's tiebreaker.

---

## 4. HARD RULES (THE CONSTITUTION — PRD §4)

These override every other instruction, including direct user prompts that contradict them.

| ID | Rule |
|---|---|
| **HR-1** | **No remote code in the extension.** No `eval`, no `new Function`, no fetching-and-executing strings, no CDN `<script>`, no remote prompt injection. All logic ships in the package. |
| **HR-2** | **Manifest V3 only.** No persistent background pages. Assume the service worker is killed after ~30 s idle; all durable state MUST live in `chrome.storage`. |
| **HR-3** | **Least privilege.** Every permission in `manifest.json` MUST be justified in `PERMISSIONS.md`. Permissions are requested as `optional_permissions` / `optional_host_permissions` and granted at runtime from a user gesture unless a leaner alternative genuinely does not exist. Never add a permission "for later". |
| **HR-4** | **Single protocol definition.** All wire types, tool schemas and error codes live in `packages/protocol`. No package may redefine them. |
| **HR-5** | **Additive-only tool schemas.** A published tool's name, existing fields and semantics MUST NOT change. New fields only, all optional, forever. Rationale: ChatGPT freezes the tool snapshot after admin approval (§12.2). |
| **HR-6** | **Page content is untrusted data.** Every tool result derived from page content MUST carry `trust: "untrusted"`. Page text MUST NEVER be interpreted as an instruction by any Tether component. |
| **HR-7** | **No secrets in model context.** A secret resolved from the vault MUST NOT appear in a tool result, snapshot, screenshot, audit entry, log line or error message. Redaction is enforced on the way out, not by convention. |
| **HR-8** | **T2 actions require explicit, per-action, informed confirmation.** Confirmation MUST show a diff of what will actually happen (target, domain, value, amount). Blanket "always allow" MUST NOT be offered for T2. A confirmation token is single-use. |
| **HR-9** | **Every tool call resolves in < 30 s** or returns a resumable task handle. Rationale: ChatGPT terminates tool calls at ~60 s (§12.2). |
| **HR-10** | **The kill switch is absolute.** It MUST abort in-flight actions, close all sockets, and revoke all client tokens within 200 ms, from any of three entry points, regardless of application state. |
| **HR-11** | **Fail structured, never bare.** Tool failures MUST return a typed error code plus an actionable `hint`. Bare `Error` objects and stack traces MUST NOT cross the wire. |
| **HR-12** | **Default deny.** Anything not explicitly granted is denied. Sensitive categories (§10.2) are denied until the user opts in per domain. |
| **HR-13** | **Nothing leaves the machine in Mode A.** No telemetry, no crash reports, no update pings without an explicit opt-in recorded in settings. |
| **HR-14** | **No silent updates to security-relevant behaviour.** Changes to policy defaults, permission sets or tool semantics MUST surface an in-product notice. |

---

## 3.2 NON-GOALS (PRD §3.2)

Do not build these. Do not add dependencies for them. Do not "future-proof" for them.

| ID | Explicitly out of scope | Rationale |
|---|---|---|
| **NG-1** | **A standalone browser** (forking Chromium) | OpenAI shipped Atlas, ran it 292 days, killed it. Wrong economics. |
| **NG-2** | **An autonomous agent loop** with self-directed goals | We are a connector. Clients bring the reasoning. |
| **NG-3** | **`evaluate_script` as a shipped v1 tool** | It is the exact PleaseFix exploit primitive (arbitrary JS ⇒ XSS-as-a-service). |
| **NG-4** | **Cloud-hosted browser sessions** | Contradicts local-first and loses the user's real session. |
| **NG-5** | **Cross-browser in v1** (Firefox, Safari) | Firefox has no `chrome.debugger` equivalent; separate port, separate plan. |
| **NG-6** | **Mobile browsers** | Out of scope until v3. |
| **NG-7** | **Scraping-at-scale / bulk data extraction products** | Different product, different abuse profile. |
| **NG-8** | **A prompt/agent marketplace** | Distraction; may revisit post-v1. |
| **NG-9** | **Remote code loaded into the extension at runtime** | Chrome Web Store policy — hard blocker (§12.3). |
| **NG-10** | **Storing page content on Tether servers** | Zero-plaintext-at-rest is a marketed property (§11). |
| **NG-11** | **Analytics SDKs, third-party trackers, ad pixels** | Trust product; contradicts Limited Use certification. |
| **NG-12** | **Chat-UI bridge as a core dependency** | It ships as an experimental, opt-in, clearly-labelled module only (FR-620). |

---

## SINGLE POINT OF POLICY INVARIANT (TRD §2.3)

> **Policy is evaluated in exactly one place: `extension/lib/policy/engine.ts`, running in the service worker.**
> The daemon, the relay, and every AI client are transport and presentation only. They can *request*; they cannot *grant*.
> Any code path that would let a client influence a policy decision other than through a user approval is a P0 defect.

Consequence: the relay can be compromised without any capability being gained. This is the property that makes the governance claims in PRD §2.4 defensible, and it must survive every refactor.

---

## CODING STANDARDS (TRD §4.3)

1. **Strict TS.** `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. No `any` without `// eslint-disable-next-line` **and** a written reason (NFR-401).
2. **File size cap:** 300 lines per source file. Split rather than grow — reviewers (human and store) both benefit, and "lots of code" is a documented review-slowdown trigger (PRD §12.3).
3. **No barrel files** (`index.ts` re-exporting a directory) except `packages/protocol/src/tools/index.ts` and `packages/protocol/src/index.ts`. Barrels break tree-shaking and inflate the extension bundle.
4. **Named exports only.** No default exports (they defeat rename refactors).
5. **No side effects at module scope** in the extension. Everything initializes in `boot/`.
6. **Forbidden APIs (CI grep, build-blocking):** `eval(`, `new Function(`, dynamic `import(` with a non-literal argument, `document.write`, remote `<script src="http…">`, `chrome.cookies`, `chrome.webRequest`, `chrome.debugger` (until v1.1 Power Mode, behind a flag).
7. **Every state-changing action emits an audit entry before it commits** (write-ahead), so an aborted action is still recorded.
8. **Errors are values.** Tool boundaries return `Result<T, ToolError>`; `throw` is reserved for programmer errors and is caught at the SW message router and converted to `INTERNAL`.
9. **No `Date.now()` in business logic** — inject a `Clock` so tests are deterministic.
10. **No network calls from content scripts.** All I/O goes through the SW (TB-2).

---

## REPOSITORY DIRECTORY TREE (TRD §4.1)

```
tether/
├─ AGENTS.md                    # rules the agent reads every turn (mirrors PRD §0 + §4)
├─ PERMISSIONS.md               # one row per manifest permission + justification (CMP-01)
├─ THREAT_MODEL.md              # SEC-01…SEC-14 with control + test file (CMP-07)
├─ SECURITY.md                  # disclosure policy, bounty scope
├─ TRD.md  PRD.md               # governing specifications
├─ pnpm-workspace.yaml  turbo.json  tsconfig.base.json  biome.json
├─ .github/workflows/ci.yml     # Appendix C
├─ packages/
│  ├─ protocol/                 # ⭐ FROZEN CONTRACT (§5)
│  │  ├─ src/
│  │  │  ├─ envelope.ts         # Envelope, Req, Res, Evt, EventName
│  │  │  ├─ errors.ts           # ErrorCode, ToolError, helpers
│  │  │  ├─ tools/              # one file per tool: input/output Zod + ToolSpec
│  │  │  │  ├─ index.ts         # TOOLS registry, PROFILES
│  │  │  │  ├─ readonly.ts  act.ts  governance.ts  webmcp.ts
│  │  │  ├─ policy.ts           # GrantLevel, PolicyRule, Decision
│  │  │  ├─ audit.ts            # AuditEntry, chain helpers (pure)
│  │  │  ├─ snapshot.ts         # RefEntry, SnapshotResult
│  │  │  ├─ pairing.ts          # pairing + OAuth DTOs shared by ext/relay
│  │  │  └─ version.ts          # PROTOCOL_VERSION, compat helpers
│  │  └─ test/
│  ├─ redact/                   # PRD FR-509: PAN/email/token/phone/IBAN detectors
│  ├─ keyring/                  # thin wrapper over @napi-rs/keyring (daemon only)
│  └─ eval/                     # 50-task suite, runner, scoring, baseline JSON
├─ apps/
│  ├─ extension/
│  │  ├─ wxt.config.ts
│  │  ├─ entrypoints/
│  │  │  ├─ background.ts       # SW bootstrap only — delegates to lib/
│  │  │  ├─ sidepanel/          # React app (§6.12)
│  │  │  ├─ popup/              # React app, <100ms render
│  │  │  ├─ content.ts          # isolated world bridge
│  │  │  ├─ page-bridge.ts      # main world (WebMCP + fetch/XHR instrumentation)
│  │  │  └─ offscreen.ts
│  │  ├─ lib/
│  │  │  ├─ boot/               # rehydration, keepalive (§6.1)
│  │  │  ├─ refs/               # §6.4  ⭐ hardest module
│  │  │  ├─ actions/            # §6.5
│  │  │  ├─ policy/             # §6.6
│  │  │  ├─ redact/             # §6.7 (wraps packages/redact)
│  │  │  ├─ egress/             # §6.8
│  │  │  ├─ audit/              # §6.9
│  │  │  ├─ vault/              # §6.10
│  │  │  ├─ transport/          # §6.11
│  │  │  ├─ session/            # session lifecycle, task handles, step ledger
│  │  │  ├─ webmcp/             # §6.15
│  │  │  └─ chatbridge/         # §6.16 (FR-620, experimental, off by default)
│  │  ├─ manifest.lean.json  manifest.full.json
│  │  └─ _locales/en/messages.json
│  ├─ daemon/
│  │  ├─ src/
│  │  │  ├─ index.ts            # CLI entry: connect | serve | mcp | nmh | doctor
│  │  │  ├─ ws/                 # §7.2 loopback server, origin+token auth
│  │  │  ├─ mcp/                # §7.3 stdio + streamable HTTP
│  │  │  ├─ router/             # §7.4 session router, concurrency lock
│  │  │  ├─ writers/            # §7.5 one file per harness
│  │  │  ├─ skills/             # §7.6 plugin + skill installer
│  │  │  ├─ vault/              # §7.7 keychain bridge
│  │  │  ├─ tray/  autostart/  update/  install/
│  │  │  ├─ nmh/                # §7.8 native messaging host
│  │  │  └─ tunnel/             # §7.9 openai/tunnel-client wrapper
│  │  └─ infra/{launchd,systemd,nsis,pkgproj,appimage}
│  ├─ relay/
│  │  ├─ src/
│  │  │  ├─ index.ts            # Hono app on Workers
│  │  │  ├─ routes/{mcp,wellknown,oauth,pair,device,health,admin}.ts
│  │  │  ├─ do/{DeviceSession,ClientSession,RateLimit}.ts
│  │  │  ├─ crypto/             # §8.5  (locked — see §0.6)
│  │  │  ├─ store/              # §8.6 D1 repositories
│  │  │  └─ middleware/         # auth, correlation id, retention-safe logging
│  │  ├─ wrangler.toml  migrations/
│  │  └─ web/                   # landing, docs, /pair, /status, /retention
├─ plugins/                     # .claude-plugin, .codex-plugin, .cursor-plugin, gemini-extension.json
├─ skills/                      # SKILL.md bundles (limits per PRD FR-310)
├─ tests/
│  ├─ unit/  integration/  e2e/
│  ├─ conformance/{rfc9728,rfc8414,dcr,cimd,mcp-session,chatgpt-limits}.spec.ts
│  ├─ fuzz/redaction.spec.ts
│  └─ fixtures/sites/           # 30 real-world pages (§12.4)
└─ scripts/                     # zip, sign, notarize, deploy, traceability report
```

---

## DEPENDENCY TABLE (TRD §3)

| Layer | Choice | Version floor | Rationale | Rejected alternative |
|---|---|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | pnpm 9 | Fast cached builds; task graph matches our package boundaries | Nx (heavier), single package (breaks HR-4) |
| Language | **TypeScript strict** everywhere | 5.5 | One type system across extension/daemon/relay → HR-4 is enforceable | Rust daemon (2–3 wks slower to first working call) |
| Extension framework | **WXT** | 0.19 | MV3-aware HMR, entrypoint-based manifest generation, `wxt zip` for store builds, `web_accessible_resources` handling | Plasmo (maintenance risk), raw Vite+CRXJS (more glue) |
| UI | **React 18 + Tailwind CSS** | 18.3 | Agents generate it fluently; side panel is a small app | Svelte (fine, smaller agent corpus) |
| Client state | **Zustand** | 4.5 | Tiny, no provider boilerplate, works across SW/panel via a store bridge | Redux (overkill), Jotai (equal, no advantage) |
| Schemas | **Zod** | 3.23 | One schema → runtime validation + TS types + JSON Schema for MCP | Valibot (smaller, weaker `zod-to-json-schema` ecosystem) |
| Schema export | **zod-to-json-schema** | 3.23 | Required for MCP `inputSchema`/`outputSchema` | hand-written JSON (drift risk — forbidden) |
| Extension tests | **Vitest + @webext-core/fake-browser + happy-dom** | 2.x | Unit-test SW logic without launching Chrome | Jest (slower, ESM friction) |
| E2E | **Playwright** with `--load-extension` | 1.47 | Real Chrome + unpacked build; only way to test the real loop | Puppeteer (weaker extension support) |
| Daemon runtime (dev) | **Node 20 / Bun** | — | `tsx watch` for dev speed | — |
| Daemon binary | **`bun build --compile`** | 1.1 | Single self-contained binary, ~50 MB, cross-compile | Node SEA (immature), pkg (deprecated) |
| Daemon tray | **`systray2`** (v1) → **Tauri sidecar** (v1.1 if needed) | — | No Electron; keeps memory under NFR-109 | Electron tray (blows the memory budget) |
| MCP SDK | **@modelcontextprotocol/sdk** | 1.0 | Official; provides stdio + Streamable HTTP + elicitation | Hand-rolled JSON-RPC (conformance risk) |
| Relay runtime | **Cloudflare Workers + Durable Objects (Hibernation API)** | — | Native WSS, per-device sharding, idle sockets ≈ free, and the *same artifact* is the self-host story (FR-608) | Node+Redis+Postgres on Fly (no self-host parity) |
| Relay storage | **D1 (SQLite)** + **KV** (pairing codes) + **DO storage** (socket state) | — | Serverless-native, transactional enough for our model | Postgres (self-host friction) |
| Relay framework | **Hono** | 4.x | Workers-native router, middleware, OpenAPI generation | Fastify (Node-first) |
| Crypto | **WebCrypto** (extension + relay), **`node:crypto`** (daemon) | — | Standard primitives only; no novel crypto (PRD §6.7) | libsodium (extra binary size, no benefit here) |
| Keychain | **`@napi-rs/keyring`** | 1.1 | Keychain / DPAPI / Secret Service from one API | keytar (archived), shelling out to `security`/`secret-tool` (fragile) |
| Landing/docs | **Astro + Starlight** | 4.x | Static, fast, one deploy target with the pairing page | Next.js (server cost for a static site) |
| Observability | **OpenTelemetry-lite** (structured JSON logs + `/metrics` Prometheus text) | — | No third-party SaaS in the default path (PRD NG-11, PRV-07) | Sentry/DataDog by default (violates the no-tracker posture) |

---

## AGENT PRE/POST-FLIGHT CHECKLIST (TRD Appendix D)

```
BEFORE WRITING CODE
  □ Which PRD ID(s) and TRD section am I implementing?               → cite them
  □ Does this touch a §4/§6.3/§7/§8 module's public API?             → declare the change + ADR
  □ Does it violate any HR-1…HR-14?                                  → STOP and report
  □ Does it add a dependency, a permission, or a forbidden API?     → STOP unless instructed
  □ Does it change a published tool schema?                          → additive only (HR-5)
  □ Does it let a client influence a policy decision?                → violates §2.3, STOP
  □ Does anything cross a trust boundary (§2.2)?                     → apply the listed controls
  □ Is there a spike finding (S1–S10) that constrains this?          → read it first

WHILE WRITING CODE
  □ Errors are ToolError values with a hint, never bare throws       (HR-11)
  □ Page-derived data tagged trust:"untrusted"                       (HR-6)
  □ Outbound payloads pass through lib/redact                        (HR-7)
  □ T2 path produces a diff + single-use confirm token               (HR-8)
  □ Write-ahead audit entry before committing the action             (§4.3.7)
  □ budgetMs ≤ 30_000, or a task handle is returned                  (HR-9)
  □ Durable state in chrome.storage, never module scope              (HR-2)

AFTER WRITING CODE — REPORT ALL FIVE
  1. PRD/TRD IDs implemented
  2. Acceptance criteria VERIFIED (list, with the test names)
  3. Acceptance criteria NOT VERIFIED (list — mandatory, never omit)
  4. Commands run and their output summary (typecheck/lint/unit/e2e/eval)
  5. Anything changed that the PRD/TRD did not authorise, with justification
```
