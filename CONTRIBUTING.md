# Contributing to Tether

Thanks for your interest in contributing to Tether! 🎉

Tether is the neutral, governed control plane between AI assistants and your real
browser. Because this project handles people's live logins and their secrets, the
governing rules in [`AGENTS.md`](AGENTS.md) and the hard invariants in
[`PRD.md` §4](PRD.md) apply to every contribution — including HR-1 (no remote code),
HR-3 (least privilege), HR-7 (no secrets in model context), and HR-10 (absolute kill
switch). When in doubt, ask before you build.

By participating in this project you agree to abide by the Contributor Covenant
Code of Conduct: <https://www.contributor-covenant.org/version/2/1/code_of_conduct/>.
Instances of abusive, harassing, or otherwise unacceptable behavior should be
reported to the maintainers via GitHub (private message to a maintainer or a
security advisory marked "CoC report").

---

## How to Contribute

### Reporting bugs

Open a [GitHub Issue](../../issues) and include:

1. **Reproduction steps** — minimal, numbered, starting from a clean checkout.
2. **Expected vs. actual behavior** — one sentence each.
3. **Environment details** — OS, Chrome version, Node version, daemon version
   (`node apps/daemon/dist/index.js doctor` output), extension version.
4. **Logs** — the daemon audit tab entries (never page content or secrets!) and
   any console output. **Never paste page content, tokens, or captured
   screenshots into an issue.**

### Suggesting features

Open a [GitHub Discussion](../../discussions) (preferred) or an Issue titled with
a `[Feature]` prefix. Describe the user problem first, then the proposed
behavior. Feature suggestions that touch security defaults (permission sets,
policy tiers, T2 confirmation UX) are reviewed by maintainers with extra care —
they change in-product notices are required (PRD HR-14).

### Submitting pull requests

1. Fork the repository and create a branch from `main`:
   `git checkout -b feat/my-change`.
2. Implement the change, including tests (see [Testing requirements](#testing-requirements)).
3. Run the full gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm check`.
4. Reference the issue number in the PR description ("Fixes #123").
5. Submit the PR. Keep it focused — one logical change per PR.

---

## Development Setup

### Prerequisites

- **Node 18+** (20 LTS recommended)
- **pnpm 8+** (9 recommended)
- **Chrome 116+** (for extension testing; e2e runs real Chrome)
- **Windows:** OCR redaction uses Windows.Media.Ocr natively; macOS/Linux
  gracefully degrade in tests.

### Getting started

```bash
git clone https://github.com/jyotitiwari250657/Tether-MCP-server.git
cd tether
pnpm install
pnpm build
pnpm test        # unit tests
pnpm test:e2e    # real Chrome, headed — needs a display
```

### Running the product locally

```bash
# Start the daemon (loopback WebSocket + MCP HTTP)
node apps/daemon/dist/index.js serve

# Load the unpacked extension
# chrome://extensions → Developer mode → Load unpacked → apps/extension/.output/chrome-mv3
```

---

## Code Style

- **Biome** is the linter and formatter: `pnpm lint` (CI enforces it).
- **Strict TypeScript** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
  No `any` without an eslint-disable AND a written reason.
- **≤ 300 lines per source file.** Split rather than grow.
- **Named exports only.** No default exports.
- **No side effects at module scope** in the extension; everything initializes in `boot/`.
- **Errors are values.** Tool boundaries return typed `ToolError`s with actionable
  hints; `throw` is reserved for programmer errors.
- **No `Date.now()` in business logic** — inject a `Clock` so tests stay deterministic.

PRD hard rules (no remote code, no forbidden APIs, additive-only tool schemas,
page content is untrusted) are enforced by scripts in `scripts/check-*.mjs` and
will reject non-compliant PRs mechanically.

---

## Testing Requirements

- **All new code ships with tests.** Target ≥ 80 % coverage on new modules.
- Every test name cites the requirement it verifies (PRD/TRD ID), e.g.
  `test("FR-204 resolves via textSig when nodeId detaches")`.
- User-facing features need an e2e scenario under `tests/e2e/`.
- Redaction/security changes need a case in the fuzz or threat-model suites.
- The full gate must pass: `pnpm typecheck && pnpm lint && pnpm test && pnpm check`.

---

## PR Review Process

- Maintainers aim to review within **1 week**.
- **CI must pass** (typecheck, lint, unit tests, `pnpm check`) before review.
- Approved PRs are **squash-merged** with a descriptive first line.
- Security-relevant PRs get a second maintainer sign-off (see `SECURITY.md`).

---

## Release Process

See [`docs/RELEASE.md`](docs/RELEASE.md) for the full gate list.

**Maintainers cut releases.** Contributors should **not** bump versions or touch
changelogs in their PRs — release automation handles it after merge.

---

## License

By contributing, you agree that your contributions will be licensed under the
MIT License that covers this project.
