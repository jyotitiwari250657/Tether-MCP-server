# Security Policy

### Doc ID: SEC-TETHER-001

Tether is a governance and security control plane for AI-driven browser interaction. We take vulnerabilities with the utmost seriousness.

---

## 1. Reporting a Vulnerability

**Please do NOT open public GitHub issues for security bugs.**

Report security vulnerabilities via **GitHub Security Advisories (private)** — this is the
primary and sufficient channel on its own:

1. **GitHub Security Advisories (primary, private):** use the
   ["Report a vulnerability"](../../security/advisories/new) button on this repository.
2. **Email (optional):** `security@<YOUR-DOMAIN>` — configure and verify a mailbox you own
   before announcing it, or simply omit email and rely on GHSA. Do not publish an email on
   a domain you do not control; it invites squatting and impersonation.

Include:

- Detailed description of the vulnerability.
- Exact reproduction steps or a proof-of-concept (PoC) script.
- Affected components and versions (`node apps/daemon/dist/index.js doctor` output helps).
- Impact assessment.

**Never** include real secrets, captured page content, or screenshots in a report —
redact before sending.

---

## 2. Response Timeline

| Stage | Target |
|---|---|
| Acknowledgment of receipt | **Within 48 hours** |
| Triage & reproduction | **Within 1 week** |
| Patch for **critical** vulnerabilities (RCE, secret leakage, kill-switch bypass) | **Within 72 hours** of confirmation |
| Patch for high/medium findings | Next scheduled release |
| Public disclosure | 30 days post-patch (see §5) |

---

## 3. Bug Bounty

Tether currently operates a **self-managed bug bounty**:

- **Valid critical reports receive USD 500 – 5 000**, severity-dependent
  (assessed with CVSS v3.1 plus abuse-realism review by maintainers).
- Lower-severity valid reports receive public credit in the release notes
  (opt-in) and our gratitude.
- We plan to migrate to **HackerOne in v1.0.0**; this section will be updated then.

### In-Scope Assets

- **Chrome Extension (`apps/extension`):** Permission escalations, service worker sandbox escapes, policy engine bypasses (T0/T1/T2 escalation), redactor bypasses leaking cleartext secrets to model context, kill-switch circumvention.
- **Local Daemon (`apps/daemon`):** Unauthorized WebSocket connections from non-extension origins, loopback binding escapes, keychain credential exfiltration, OCR/redaction pipeline content leaks into logs or audit entries.
- **Relay (`apps/relay`):** Authentication bypasses, OAuth 2.1 / PKCE flaws, cryptographic weaknesses in E2E envelope handling, unauthorized cross-tenant session access.
- **Protocol (`packages/protocol`):** Schema confusion that downgrades security guarantees, envelope forgery across trust boundaries.
- **Device Pairing Flow:** Replay attacks, short-lived code brute-forcing, device impersonation.

### Explicitly Out-of-Scope

- Denial-of-service attacks that exhaust local CPU/RAM on the user's personal machine.
- Physical attacks requiring root/admin shell access to the user's running operating system.
- Social engineering or phishing targeting Tether team members or users.
- Vulnerabilities in third-party harnesses (Claude Code, Cursor, Codex CLI, ChatGPT) outside the boundary of Tether's connector interface.
- Theoretical attacks on standard cryptographic primitives (e.g. quantum attacks against Curve25519).

---

## 4. Zero-Plaintext-at-Rest Property (PRD PRV-03)

Tether is architected under the **zero-plaintext-at-rest** invariant:

- The Tether relay (hosted or self-hosted) never decrypts, inspects, or persists cleartext web page content, form inputs, or tool arguments.
- End-to-end payloads between the client/relay and the local browser extension are sealed using X25519 authenticated key exchange and AES-256-GCM.
- Relational metadata stores keep exclusively cryptographic hashes, timestamps, and routing identifiers. Any database column storing raw page content, arguments, or URLs is blocked by CI static analysis (TRD Appendix B).
- Screenshot OCR redaction runs **locally in the daemon**; image bytes never enter logs, audit entries, or error messages (Prompt 11, AC-P11-05).

---

## 5. Disclosure Policy

We follow **coordinated disclosure**:

1. The report is triaged and confirmed privately.
2. A patch is developed and released (critical: within 72 h of confirmation).
3. Users are notified via a **GitHub Security Advisory** and the release notes.
4. **Public disclosure happens 30 days after the patch is available** — or sooner
   if the vulnerability is actively exploited in the wild.

We credit reporters in advisories unless they prefer to remain anonymous.

---

## 6. Severity Examples

| Severity | Example in Tether's context |
|---|---|
| Critical | Remote code execution via the relay; kill-switch bypass; cleartext secret reaching a model provider despite redaction |
| High | Policy engine bypass that upgrades a T0 read to a T2 submit; loopback token theft path |
| Medium | Information disclosure in daemon logs (no secrets); degraded-mode UX that silently drops redaction without the `ocrDegraded` signal |
| Low | Missing rate limits on non-sensitive endpoints; defense-in-depth gaps with no exploit path |

If you are unsure where your finding falls, report it — we would rather triage
than miss it.
