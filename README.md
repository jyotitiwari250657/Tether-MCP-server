# Tether

<div align="center">

![Tether hero](docs/assets/hero.png)

**Private, local-first browser control for AI assistants.**

*One connector. Every AI. Your browser, your rules.*

</div>

---

Connect any AI assistant — **Claude, ChatGPT, Codex, Cursor** — to your real,
logged-in browser, with **per-site permissions, per-action approvals, and a
tamper-evident audit log**. No cloud relay required.

Tether is a *connector*, not an agent: the AI client brings the reasoning, Tether
enforces your governance. Policy is evaluated in exactly one place — the extension's
policy engine — so a compromised client or relay gains **zero** capabilities
(TRD §2.3).

> ⚠️ **Beta.** Tether is under active development. See
> [Beta limitations](#beta-limitations) before relying on it.

---

## Quick start

```bash
git clone https://github.com/tether-ai/tether.git
cd tether
pnpm install
pnpm build

# Start the local daemon
node apps/daemon/dist/index.js serve

# Load the unpacked extension
#   chrome://extensions → Developer mode → Load unpacked
#   → apps/extension/.output/chrome-mv3
```

Then point your MCP client at `http://127.0.0.1:18796/mcp` (streamable HTTP) or
run `node apps/daemon/dist/index.js connect claude-code` to configure a harness
automatically.

![Tether demo — snapshot → click flow, recorded from the real daemon + Chrome](docs/assets/demo.gif)

---

## How it works

```
┌──────────────┐   MCP (stdio / HTTP)   ┌─────────────────┐
│  AI client   │ ◄────────────────────► │  Local daemon   │
│ (your model) │                        │  127.0.0.1 only │
└──────────────┘                        └────────┬────────┘
                                                 │ loopback WS + token auth
                                        ┌────────▼────────┐
                                        │  MV3 extension  │
                                        │  policy engine  │  ← the single point
                                        │  redaction      │    where capability
                                        │  audit chain    │    is granted
                                        └─────────────────┘
```

- **40 tools** across read (`browser_snapshot`, `browser_find`, `browser_get_text`, …)
  and act (`browser_click`, `browser_type`, `browser_submit`, …), plus the
  kill switch and vault integration.
- **Zero plaintext on the wire** for hosted mode — X25519 + AES-256-GCM sealed
  envelopes end-to-end; the relay carries no readable content (PRV-03).
- **Local OCR screenshot redaction** — `browser_screenshot` redacts rendered
  secrets (PAN, email, bearer tokens, API keys, private keys) *on this machine*
  before the image is returned. Image bytes never leave the device.
- **Kill switch** — one click aborts in-flight actions, closes sockets and revokes
  tokens in < 200 ms, from three entry points, and stays killed across reconnects
  (HR-10) until you explicitly reset it.
- **Tamper-evident audit chain** — every state-changing action is recorded
  write-ahead; hashes chain entries so tampering is detectable.

---

## Three modes (PRD §7.2)

| Mode | Path | Best for | Status |
|---|---|---|---|
| **A — Local** | AI client ⇄ `127.0.0.1` daemon ⇄ extension | CLI & IDE harnesses (Claude Code, Codex, Cursor) | ✅ shipped |
| **B — Hosted** | Extension ⇄ outbound WSS ⇄ relay ⇄ public `/mcp` | ChatGPT Business+, claude.ai, mobile | 🚧 in progress |
| **C — In-page** | WebMCP proxy + optional chat-UI bridge | Gemini in Chrome, web chatbots | 🔬 experimental |

Mode A requires **no network access** and no cloud account. Everything runs on
your machine.

---

## Why it's safe by construction

| Risk | Control |
|---|---|
| Secret leakage into model context | Outbound redaction (PAN w/ Luhn, email, phone, IBAN, bearer/JWT, API keys, private-key blocks) + on-device OCR redaction of screenshots |
| Unapproved destructive actions | Three-tier policy (T0 read / T1 write / T2 submit), T2 requires a per-action diff + single-use confirmation token |
| Prompt injection from web pages | Page content is untrusted data (HR-6); injection fixtures in the 50-task eval suite |
| Runaway agents | Rate limits, action budgets (< 30 s or resumable task handles), kill switch |
| Silent surveillance | No telemetry, no crash reporting, no update pings without explicit opt-in (HR-13) |
| Over-broad permissions | `optional_permissions` granted at runtime from user gestures, each justified in `PERMISSIONS.md` (HR-3) |

Full analysis: [`THREAT_MODEL.md`](THREAT_MODEL.md).

---

## Beta limitations

We'd rather tell you than oversell:

- **Demo Mode is not shipped** — there is no simulated browser; Tether drives your real Chrome.
- **Egress monitoring is detect-only** in v1 — main-world fetch/XHR instrumentation alerts
  but does not block; CDP-based blocking arrives with Power Mode (v1.1).
- **Chrome only** — no Firefox/Safari port yet (Firefox lacks a `chrome.debugger`
  equivalent); no mobile.
- **WebMCP in-page bridge requires Chrome 149+** and is experimental, opt-in, and
  clearly labelled.
- **Screenshot OCR redaction is best-effort** — it runs locally and is pattern-driven;
  heavily stylised fonts or text baked into images-of-images may evade it. Screenshots
  are always annotated `openWorldHint:true` and the side panel shows an amber badge
  when OCR is unavailable.
- **Hosted relay (Mode B) is in development** — the self-host path exists
  (`apps/relay`, `RELAY_MODE=selfhost`) but the managed relay is not generally available.

---

## Documentation

| Doc | Contents |
|---|---|
| [`PRD.md`](PRD.md) | Product requirements, hard rules (§4), non-goals (§3.2) |
| [`TRD.md`](TRD.md) | Technical design, module boundaries, dependency table |
| [`THREAT_MODEL.md`](THREAT_MODEL.md) | SEC-01…SEC-14 threat→control matrix |
| [`PERMISSIONS.md`](PERMISSIONS.md) | One row per manifest permission + justification |
| [`SECURITY.md`](SECURITY.md) | Reporting vulnerabilities, disclosure policy, bounty |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Dev setup, code style, PR process |
| [`docs/RELEASE.md`](docs/RELEASE.md) | Release gates |
| [`docs/`](docs/) | Submission prep, traceability, protocol reference |

---

## Contributing

Issues and pull requests are welcome! Start with
[`CONTRIBUTING.md`](CONTRIBUTING.md) — it covers dev setup, the (strict!) code
style, and the testing bar. Security bugs: please follow
[`SECURITY.md`](SECURITY.md) rather than opening a public issue.

---

## License

[MIT](LICENSE) © Tether Authors
