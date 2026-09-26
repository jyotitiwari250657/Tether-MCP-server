<!-- GENERATED — DO NOT EDIT -->
# Tether Protocol Specification (v1)

> **Doc ID:** SPEC-PROTOCOL-001 · **Milestone:** M0+ · **Governing PRD:** HR-4, HR-5 · **TRD:** §5
>
> This document is mechanically generated from `packages/protocol/src/` via `pnpm --filter @tether/protocol generate`.
> Any manual modifications to this file will cause CI to fail.

---

## 1. Protocol Versioning (TRD §5.1, PRD HR-5)

- `PROTOCOL_VERSION = 1` (literal constant).
- **Additive-Only Rule:** All schemas are strictly additive. Published fields are immutable.
- **Compatibility:** Peer versions must match `PROTOCOL_VERSION` exactly.

---

## 2. Wire Envelope (TRD §5.2, Appendix A)

All communication across extension, daemon, and relay links uses a versioned envelope `{ v: 1, id, session, ts, ... }`:

| Kind | Discriminator | Description | Size Cap |
|---|---|---|---|
| `req` | `kind: "req"` | Action or meta tool invocation | 64 KB args |
| `res` (ok) | `kind: "res", ok: true` | Successful tool result with execution ms | 900 KB (chunked) |
| `res` (err) | `kind: "res", ok: false` | Structured ToolError with actionable hint | 64 KB |
| `evt` | `kind: "evt"` | Async streaming notification / elicitation | 64 KB |

- **Maximum Envelope Bytes:** `921,600` bytes (900 KB limit for Chrome Native Messaging).
- **Forward Compatibility:** Unrecognized event names are ignored rather than rejected.

---

## 3. Error Catalogue (TRD §5.5, PRD HR-11)

Every tool failure emits a typed `ErrorCode` with an actionable `hint` formulated specifically for AI model guidance:

| Error Code | Retryable | Model Hint |
|---|---|---|
| `REF_STALE` | Yes | Call browser_snapshot once, then retry with the new ref. |
| `REF_NOT_FOUND` | No | Call browser_snapshot to obtain current refs. |
| `TAB_GONE` | No | — |
| `UNSUPPORTED_FRAME` | No | — |
| `POLICY_DENIED` | No | Do not retry. Ask the user with ask_user, or call policy_grant to request access. |
| `PERMISSION_REQUIRED` | No | — |
| `NEEDS_CONFIRMATION` | No | Call confirm_action with the returned confirmId and diff; wait for the user. |
| `CONFIRM_TOKEN_INVALID` | No | — |
| `CONFIRM_TOKEN_EXPIRED` | No | — |
| `DEVICE_OFFLINE` | No | — |
| `DEVICE_BUSY` | Yes | Another client is driving the browser. Tell the user; do not retry in a loop. |
| `RATE_LIMITED` | Yes | Wait retryAfterMs, then retry once. |
| `TIMEOUT` | Yes | Use browser_task_start for work that exceeds 30 seconds. |
| `SESSION_ABORTED` | No | The user engaged the kill switch. Stop. |
| `SCHEMA_INVALID` | No | Fix the schema and retry; see details.errors for the failing paths. |
| `EGRESS_BLOCKED` | No | — |
| `INTERNAL` | No | — |

---

## 4. Accessibility Snapshots & Ref Resolution (TRD §5.4, §6.4)

- Elements are indexed into accessibility trees with stable identifiers (`A1`, `B4`).
- `RefEntry` records `nodeId`, `cssPath`, `xpath`, `textSig`, `rect`, and accessibility metadata.
- `SnapshotResult` includes token count, truncation cursor, title, URL, and `trust: "untrusted"`.

---

## 5. Governance & Single-Use Confirmation (TRD §5.3, §6.6, PRD HR-8)

- **Risk Tiers:** T0 (Auto on grant), T1 (Ask once per session), T2 (Always explicit diff confirmation), T3 (Meta-tools).
- **Confirmation Diffs:** High-risk actions generate structured diff rows (`[action, target, domain, value, consequence]`).
- **Tokens:** Diff-bound, single-use, 5-minute TTL.

---

## 6. Tamper-Evident Audit Logging (TRD §5.3, §6.9, PRD FR-512)

- Append-only cryptographic hash chain: `hash = SHA-256(prevHash + canonicalJson(entry))`.
- Canonical JSON sorts object keys lexicographically with no whitespace.
- Non-repudiation verification runnable locally at any time via `verifyChain()`.

---

## 7. Tool Registry Surface (TRD §5.4, §10, PRD FR-611, FR-612)

- **Total Registered Tools:** 40 tools across Readonly, Act, and Governance profiles.
- **Profiles:** `browser-readonly` (token budget <= 2,500), `browser-act` (token budget <= 4,500).
- **Forbidden Tools (Banned in v1.0):** `evaluate_script`, `network_request`, `cookies_get`, `cookies_set`, `history_read`, `bookmarks_read`.
- **Namespace Pattern:** `/^(browser|site|policy|audit|session|ask|confirm)_[a-z_]+$|^(search|fetch)(_[a-z_]+)?$/`.

| Tool Name | Title | Tier | Profiles | Budget (ms) | Description |
|---|---|---|---|---|---|
| `ask_user` | Ask user | T3 | browser-readonly, browser-act | 30000 | Ask user a question. |
| `audit_export` | Export audit | T3 | browser-readonly, browser-act | 10000 | Export audit log entries. |
| `browser_click` | Click | T1 | browser-act | 1500 | Click element by ref. |
| `browser_dialog` | Dialog | T2 | browser-act | 2000 | Accept or dismiss dialog. |
| `browser_download` | Download | T2 | browser-act | 15000 | Download file from page. |
| `browser_drag` | Drag | T1 | browser-act | 2500 | Drag element from ref to ref. |
| `browser_extract` | Extract | T0 | browser-readonly, browser-act | 8000 | Extract structured data using schema. |
| `browser_fill_form` | Fill form | T1 | browser-act | 5000 | Fill multiple form fields. If secretId is present, value is ignored. |
| `browser_find` | Find | T0 | browser-readonly, browser-act | 2000 | Find element refs matching query. |
| `browser_get_text` | Get text | T0 | browser-readonly, browser-act | 1500 | Get readable text from ref or selector. |
| `browser_hover` | Hover | T1 | browser-act | 1500 | Hover over element by ref. |
| `browser_list_network` | Network | T0 | browser-readonly, browser-act | 1000 | List page network requests. |
| `browser_list_tabs` | List tabs | T0 | browser-readonly, browser-act | 1000 | List open browser tabs. |
| `browser_navigate` | Navigate | T1 | browser-act | 5000 | Navigate tab to URL. |
| `browser_press_key` | Press key | T1 | browser-act | 1500 | Press key combination. |
| `browser_read_console` | Console | T0 | browser-readonly, browser-act | 1000 | Read browser console messages. |
| `browser_screenshot` | Screenshot | T0 | browser-readonly, browser-act | 3000 | Capture page or element screenshot. |
| `browser_scroll` | Scroll | T1 | browser-act | 1500 | Scroll page or element. |
| `browser_select` | Select | T1 | browser-act | 1500 | Select dropdown option by value or label. |
| `browser_snapshot` | Snapshot | T0 | browser-readonly, browser-act | 2000 | Capture DOM a11y tree snapshot with refs. |
| `browser_submit` | Submit | T2 | browser-act | 5000 | Submit form by ref with confirm token. |
| `browser_tabs` | Tabs | T1 | browser-act | 3000 | Manage browser tabs. |
| `browser_task_start` | Task start | T1 | browser-act | 1000 | Start async task and get taskId. |
| `browser_task_status` | Task status | T1 | browser-act | 1000 | Check status of async task. |
| `browser_type` | Type | T1 | browser-act | 3000 | Type text into element. |
| `browser_type_secret` | Type secret | T2 | browser-act | 3000 | Type secret credential into field. |
| `browser_upload` | Upload | T2 | browser-act | 5000 | Upload file to input element. |
| `browser_wait_for` | Wait for | T1 | browser-act | 10000 | Wait for text or selector on page. |
| `confirm_action` | Confirm action | T3 | browser-readonly, browser-act | 30000 | Request user confirmation with diff. |
| `fetch` | Fetch | T0 | browser-readonly, browser-act | 10000 | Fetch URL content as markdown. |
| `policy_get` | Get policy | T3 | browser-readonly, browser-act | 1000 | Get policy rules for domain. |
| `policy_grant` | Grant policy | T3 | browser-readonly, browser-act | 30000 | Request capability grant for domain. |
| `policy_revoke` | Revoke policy | T3 | browser-readonly, browser-act | 5000 | Revoke capability grant. |
| `search` | Search | T0 | browser-readonly, browser-act | 5000 | Search company knowledge or web. |
| `session_abort` | Abort session | T3 | browser-readonly, browser-act | 1000 | Abort automation session. |
| `session_pause` | Pause session | T3 | browser-readonly, browser-act | 1000 | Pause automation session. |
| `session_resume` | Resume session | T3 | browser-readonly, browser-act | 1000 | Resume automation session. |
| `session_status` | Session status | T3 | browser-readonly, browser-act | 1000 | Get session status. |
| `site_tools_call` | Call site tool | T2 | browser-readonly, browser-act | 10000 | Call site WebMCP tool. |
| `site_tools_list` | List site tools | T2 | browser-readonly, browser-act | 3000 | List site WebMCP tools. |

---

## 8. Exported Module Surface

Total public symbols exported from root barrel: **67**
