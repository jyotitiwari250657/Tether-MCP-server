# SUBMISSION-CWS.md — Chrome Web Store submission (PRD §12.3, FR-801, FR-802, CMP-01…03)

Step-by-step for the first **unlisted** submission of v0.1.0 and every later one.

---

## 1. Publisher account (day 1 — do this before you need it)

1. Register a Chrome Web Store developer account (one-time **US$5** fee).
2. Complete **identity / trader verification** (EU DSA) immediately — it gates publishing
   and can take days. Delays here are the #1 avoidable launch blocker.
3. New publishers are capped at **2 published items**; the unlisted beta counts toward this.
   Request an increase only when needed.

## 2. Strategy: unlisted first (PRD §12.3, RK-03)

- Submit as **Unlisted** (link-only). Unlisted items are fully reviewed, so the beta cohort
  exercises the real review path while the listing stays out of search.
- Flip to **Public** only after: 20 beta testers onboarded (M2 exit), no P0 open, review
  history clean, and the M2 kill-criterion checks pass (PRD §16.3).

## 3. Upload artifact

- Build: `pnpm package-release` → `release/tether-extension-<version>-chrome-mv3.zip`.
- The zip ships the **lean manifest** (FR-102): `storage, unlimitedStorage, scripting,
  activeTab, sidePanel, offscreen, alarms, nativeMessaging`; `<all_urls>` only under
  `optional_host_permissions`. No `cookies/webRequest/history/bookmarks/debugger/tabs`
  (FR-103). Verify after unzip — see Test plan in `docs/RELEASE.md` §5.
- Store slow-down triggers to avoid: broad granted host permissions, sensitive execution
  permissions, huge unreadable bundles. Current bundle: **330 KB uncompressed JS**, light
  minification, no obfuscation (CMP-03).

## 4. Listing asset checklist

| Asset | Spec | Source file |
|---|---|---|
| Screenshots ×5 | 1280×800 PNG | `apps/web/public/store/screenshot-1..5.png` |
| Small promo tile | 440×280 PNG | `apps/web/public/store/promo-tile.png` |
| Icon | 128×128 PNG | built `icon128.png` (packed in the zip) |
| Marquee (optional) | 1400×560 | — not shipped in v0.1.0 |
| Description | ≤ 16 000 chars | long description, below |
| Short description | ≤ 132 chars | verbatim below |

## 5. Listing copy — source of truth

**Source of truth:** `apps/web/src/pages/store/index.astro`. Copy-paste from there; do not
improvise wording in the dashboard. Privacy tab: `apps/web/src/pages/store/privacy.astro`.

### Short description (126 / 132 chars — verbatim)

```
Connect any AI assistant to your real, logged-in browser — with per-site permissions, approvals and a local audit log.
```

### Single-purpose statement (verbatim — use in the listing, the Privacy tab, and docs; CMP-01)

```
Tether lets an AI assistant that the user chooses read and act on the web pages the user permits, with per-action approval and a local audit log.
```

### Required listing fields

- **Privacy policy URL** (mandatory): the hosted privacy page (`/store/privacy` from
  `apps/web`) at the production domain — confirm the final domain before submitting (FR-806).
- **Data-use certifications**: declare collection of *none* of the store's sensitive
  categories; no data sold; no data for unrelated purposes; **Limited Use** compliance
  attested (CMP-02). Page content never leaves the machine in Mode A (PRV-01/02).
- **Category**: Developer Tools.

## 6. Test-instructions block (paste into the "Test instructions" / notes-to-reviewer field)

> **Test plan (≈ 3 minutes, no account, no external services required):**
>
> 1. **Install & popup (FR-105):** Load the item. Click the toolbar icon — the popup renders
>    instantly showing connection state, transport mode and a red **Kill Switch** button.
> 2. **Side panel (FR-701):** Open the side panel. Four tabs render: Session, Policy, Audit,
>    Vault. The **Policy** tab shows the default-deny posture: banking/email/health/government
>    and credential-entry origins are **denied by default** (PRD HR-12).
> 3. **Kill switch (HR-10):** Press the popup kill switch. The session stops; tokens are
>    revoked and sockets close within 200 ms. Copy shown: "Session stopped."
> 4. **Audit export (FR-512):** In **Audit → Export**, download the audit log as JSON and as
>    an HTML report. Entries are hash-chained; each shows hashes/verdicts only — never page
>    content (FR-513).
> 5. **Full agent loop (optional, needs our local daemon):** `npm i -g @tether/daemon` then
>    `tether connect`; from any MCP client call `browser_snapshot` on any page — the snapshot
>    is returned with refs; a `browser_click` on a Tier-2 target raises a confirmation card
>    with an explicit diff (HR-8). A write against a default-deny origin (e.g. a banking
>    form) returns `POLICY_DENIED`.
>
> Network note: with no daemon running the extension performs **zero** network I/O (Mode A,
> PRV-02). The only outbound host in Mode B is our E2E-encrypted relay; no analytics or
> trackers are included (PRV-07, NG-11).

> **Known v0.1.0 gaps (honest):** the built-in one-click **Demo Mode** (PRD FR-107) is not
> shipped in this beta; step 5 requires the local daemon. FR-107 must land before the Public
> flip. Egress monitoring is detect-and-alert only in v1 (no `webRequest` permission).

## 7. Expected review timings (PRD §12.3, verified Sep 2026)

- Typical: **a few days**; can stretch to a few weeks. Slower for new developers, new items,
  sensitive permission requests, big code deltas — all true for first submission; plan 2–3
  weeks of slack.
- Pending > 3 weeks → contact One Stop Support (case ID in minutes, reply up to ~3 days).

## 8. Rejection → appeal playbook

1. **Read the violation email**; it cites a policy section. Map it to our docs:
   permissions → `PERMISSIONS.md`; single purpose → §5 above; remote code → HR-1 is already
   enforced by CI (`pnpm check`).
2. **Fix or justify:** if the rejection is about `<all_urls>` in
   `optional_host_permissions` (not granted), reply explaining it is **opt-in at runtime**
   with the quoted FR-102/HR-3 justification and the Demo/daemon repro.
3. **Respond** via the One Stop Support form with the case ID; keep replies factual, cite
   the policy paragraphs, attach the Test-instructions block.
4. **Ladder awareness:** rejection → warning (7–30 days) → takedown (listing 404, then
   auto-disable) → malware-level violation (all-device disable + permanent suspension). Any
   warning is the last exit before takedown: stop ships, fix, respond within the window.
5. **Escalate** only with new facts (e.g. reviewer misread optional vs granted permissions).
   Keep the tone collaborative; rejections are normal for agentic extensions.
