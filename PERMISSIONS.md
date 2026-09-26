# Permissions Specification

> **CI Enforcement Rule:** CI fails any manifest permission not present in Table 1 (Permitted Manifest Permissions).
> Under PRD HR-3, TRD §6.2, and CI Stage 3, every permission declared in `manifest.json` must have a corresponding justification row.

---

## Table 1 — Permitted Manifest Permissions (PRD FR-102, TRD §6.2)

| Permission | Used for | Why the least-privileged alternative does not work | First milestone needed |
|---|---|---|---|
| `storage` | Rehydrating session state, ref map, policy rules, and audit chain state across service-worker lifecycles. | In-memory globals are destroyed when MV3 service workers terminate after ~30s idle (HR-2). | M0 |
| `unlimitedStorage` | Retaining append-only tamper-evident audit logs and session ledgers locally. | Standard 10 MB quota risks eviction of non-repudiation audit evidence (FR-512). | M0 |
| `scripting` | Injecting content scripts and page bridges dynamically into approved tabs upon connection. | Declarative content scripts run on all matching pages unconditionally, violating least privilege. | M0 |
| `activeTab` | Temporary execution privileges on the user's currently focused tab upon invocation or gesture. | Broad host permissions (`<all_urls>`) expose all tabs unconditionally; `activeTab` scopes access. | M0 |
| `sidePanel` | Housing the core human-in-the-loop governance UI (approvals, timeline, audit viewer, kill switch). | Popups close on blur; tabs disrupt page state; side panel persists beside the active document (FR-701). | M0 |
| `offscreen` | Processing canvas operations, DOM parsing, and WASM tasks outside the service worker. | MV3 service workers lack DOM, Window, and Canvas APIs entirely. | M0 |
| `alarms` | Fallback keepalive pings during long operations and token expiry timers. | `setTimeout`/`setInterval` are cleared when the service worker is terminated by the browser (HR-2). | M0 |
| `nativeMessaging` | High-throughput loopback IPC channel between Chrome and the local daemon (`com.tether.host`). | WebSockets require open ports and origin-validation overhead; NMH provides direct OS-level pipe. | M1 |
| `<all_urls>` *(optional_host_permissions)* | Navigating and driving pages across arbitrary user-requested origins at runtime. | Requested strictly per domain or on-demand via runtime user gesture (`chrome.permissions.request`). | M1 |
| `webNavigation` *(optional_permissions)* | Detecting frame lifecycle events and SPA route changes for self-healing ref resolution. | MutationObserver cannot observe cross-document lifecycle events or cross-frame navigation reliably. | M1 |
| `downloads` *(optional_permissions)* | Exporting tamper-evident audit log chains (JSON/HTML) and diagnostic doctor bundles. | `data:` URI links may be blocked by host CSPs on certain strict enterprise web pages. | M2 |
| `notifications` *(optional_permissions)* | Alerting the user to pending high-risk (T2) action approval requests when the side panel is closed. | Without OS/browser notifications, time-sensitive approvals expire unnoticed after 5 minutes (FR-508). | M2 |

---

## Table 2 — Forbidden Permissions in v1.0 (PRD FR-103)

Any occurrence of the following permissions in v1.0 manifests or codebases constitutes a critical CI-blocking defect:

| Permission | Category | Reason Forbidden in v1.0 |
|---|---|---|
| `cookies` | Identity / Session Data | High-risk session hijacking vector. Tether drives the authenticated DOM directly without reading or exporting raw cookie jars. |
| `webRequest` | Network Interception | Enables full traffic interception and modification. Violates least privilege; egress monitoring is handled at tab and fetch boundaries. |
| `history` | Browsing Profiling | Unnecessary browsing history surveillance. Tether only acts upon tabs explicitly selected or navigated to by the user. |
| `bookmarks` | Personal Data | Reading personal bookmarks provides zero value to browser automation and violates privacy boundaries (PRD NG-11). |
| `debugger` | Intrusive Control | Displays a persistent Chrome warning infobar and permits arbitrary CDP takeover. Deferred to v1.1 "Power Mode" behind explicit user opt-in. |
| `geolocation` | Physical Tracking | Physical user coordinates are irrelevant to browser connector workflows; presents serious privacy and compliance liabilities. |
| `clipboardRead` | Clipboard Snooping | Risk of exfiltrating passwords, tokens, or personal snippets. Tether types text directly into target elements via value setters and synthetic events. |
| `tabs` | Broad Tab Inspection | Broad tab enumeration reveals URLs and titles across all open windows. Replaced by least-privileged `activeTab` and explicit user context. |
