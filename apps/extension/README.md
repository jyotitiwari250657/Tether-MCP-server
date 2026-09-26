# @tether/extension

> **Milestone:** M0/M1 (PRD §16.1, PRD §17, TRD §15)  
> **Status:** Scaffold (Implemented in **P04**)

Tether Chrome Extension (Manifest V3) built with [WXT](https://wxt.dev/), React 18, Tailwind CSS, and strict TypeScript.

---

## 1. Overview

This package is the browser extension component of Tether, governing browser control between local AI harnesses or cloud clients and the browser DOM.

Governing specifications:
- **[PRD §9.1](../../PRD.md#91-fr-1xx--extension-foundation)** — Functional Requirements (FR-101…FR-109)
- **[TRD §6](../../TRD.md#6-extension-architecture)** — Extension Architecture, MV3 lifecycle, and security model
- **[PERMISSIONS.md](../../PERMISSIONS.md)** — Manifest permission justifications (PRD HR-3)

---

## 2. Scaffold Status & Roadmap

This scaffold provides the entrypoint architecture, message bus foundations, and UI frames. Full functionality is delivered in subsequent milestone prompts:

| Module | Prompt | Milestone | Scope |
|---|---|---|---|
| **Skeleton & Manifest** | **P04** (Current) | M0/M1 | WXT build, sidepanel (4 tabs), popup, SW bootstrap, runtime content script |
| **Ref Engine & Actions** | **P05** | M1 | `lib/refs`, `lib/actions`, self-healing DOM refs, React synthetic events |
| **Policy & Governance** | **P06** | M1 | `lib/policy`, `lib/audit`, `lib/vault`, per-domain grants, hash chain |
| **Redaction & Egress** | **P07** | M1 | `lib/redact`, `lib/egress`, in-page network instrumentation |
| **Transport & Pairing** | **P08** | M1 | `lib/transport`, `lib/session`, loopback WebSocket & Native Messaging Host |

---

## 3. Entrypoints

- `entrypoints/background.ts` — MV3 module service worker bootstrap and message router
- `entrypoints/sidepanel/` — Persistent human-in-the-loop governance panel (`Session`, `Policy`, `Audit`, `Vault`)
- `entrypoints/popup/` — Fast (<100ms) toolbar status popup with connection indicator and kill switch
- `entrypoints/content.ts` — On-demand runtime injected content script (`registration: 'runtime'`)

---

## 4. Development & Build

```bash
# Start development with HMR
pnpm --filter @tether/extension dev

# Build production bundle (lean manifest for Chrome Web Store)
pnpm --filter @tether/extension build

# Build full internal testing bundle
pnpm --filter @tether/extension build:full

# Package extension zip
pnpm --filter @tether/extension zip
```
