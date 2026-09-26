---
name: Security report
about: Report a security vulnerability (use a PRIVATE advisory, not this template)
title: '[security] '
labels: security
assignees: ''
---

## STOP — read this first

**Do not describe the vulnerability in a public issue.** Public disclosure before a
patch exists puts users at risk and may forfeit bounty eligibility.

### How to report

1. Go to the **Security** tab of this repository →
   **"Report a vulnerability"** (private GitHub Security Advisory), or
2. Email the optional address in [`SECURITY.md`](../../SECURITY.md) if one is configured.

### What to include (in the private advisory)

- Detailed description of the vulnerability.
- Exact reproduction steps or a proof-of-concept (PoC).
- Affected components and versions (`node apps/daemon/dist/index.js doctor` output helps).
- Impact assessment.

**Never** include real secrets, captured page content, or screenshots — redact
before sending.

### What happens next

See [`SECURITY.md`](../../SECURITY.md) for the full response timeline: acknowledgment
within 48 hours, triage within 1 week, critical patches within 72 hours, coordinated
disclosure 30 days post-patch.
