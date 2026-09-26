---
name: Bug report
about: Report a defect in Tether
title: '[bug] '
labels: bug
assignees: ''
---

<!-- Security bugs: do NOT file a public issue. Use a private GitHub Security
     Advisory ("Report a vulnerability" on this repo) — see SECURITY.md. -->

**Checklist**

- [ ] I searched existing issues for a duplicate.
- [ ] This is not a security vulnerability (those go to private GHSA reports).
- [ ] I ran `node apps/daemon/dist/index.js doctor` and included the output below.

**Description**

A clear, one-paragraph description of the defect.

**Reproduction steps**

1. Start from a clean checkout / fresh daemon start.
2. Run `…`
3. Observe `…`

**Expected vs. actual behavior**

- Expected: …
- Actual: …

**Environment**

- OS:
- Chrome version:
- Node version:
- Daemon version (`doctor` output):
- Extension version (from `chrome://extensions`):

**Logs**

Paste daemon audit-tab entries and console output. **Never** paste real page
content, credentials, or secrets — redact before submitting.
