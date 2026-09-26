# Tether Post-Push Release & Maintenance Guide

## Release Information
- **Repository URL:** [https://github.com/jyotitiwari250657/Tether-MCP-server](https://github.com/jyotitiwari250657/Tether-MCP-server)
- **Initial Release Commit:** `4e5523fe1de64396cdb94205b7f73beaa435c091`
- **Release Tag:** `v0.1.0`
- **Release State:** Beta (v0.1.0)
- **Quality Gates:** 438 unit tests passing, 13/13 E2E scenarios passing, 50/50 live eval tasks passing (100%), uncompressed JS bundle size 339.61 KB (≤ 400 KB budget).

---

## Next Steps for the Maintainer

### 1. Enable GitHub Actions & CI
1. Navigate to repository **Settings > Actions > General**.
2. Under **Actions permissions**, select **Allow all actions and reusable workflows**.
3. Under **Workflow permissions**, ensure **Read and write permissions** are configured if automated release packaging or PR comments are enabled.
4. Verify that `.github/workflows/ci.yml` runs successfully on incoming branches and pull requests.

### 2. Configure Branch Protection Rules
1. Navigate to **Settings > Branches**.
2. Click **Add branch protection rule** for pattern `main`:
   - Check **Require a pull request before merging**.
   - Check **Require approvals** (minimum 1 review).
   - Check **Require status checks to pass before merging** (select CI workflows: `typecheck`, `lint`, `test`, `check`).
   - Check **Require conversation resolution before merging**.
   - Check **Do not allow bypassing the above settings**.

### 3. Set Up Dependabot
1. Ensure `.github/dependabot.yml` is enabled for npm/pnpm and GitHub Actions dependencies.
2. In **Settings > Code security and analysis**:
   - Enable **Dependabot alerts**.
   - Enable **Dependabot security updates**.
   - Enable **Secret scanning** and **Push protection** (active).

### 4. Create GitHub Pages (Documentation Deployment)
1. Navigate to **Settings > Pages**.
2. Under **Build and deployment**:
   - Source: **GitHub Actions** (or deploy from branch `gh-pages` if static export pipeline is configured for Astro docs in `apps/web`).
3. Point custom domain (if applicable) or access docs at `https://jyotitiwari250657.github.io/Tether-MCP-server/`.

### 5. Announce Launch Channels & Distribution
- **Chrome Web Store Submission**: Follow [docs/SUBMISSION-CWS.md](file:///c:/Users/acer/Desktop/Tether/docs/SUBMISSION-CWS.md) to upload `apps/extension/.output/tetherextension-0.1.0-chrome.zip` with store metadata, single-purpose declaration, and screenshots from `apps/web/public/store/`.
- **MCP Directory Listings**:
  - Follow [docs/SUBMISSION-ANTHROPIC.md](file:///c:/Users/acer/Desktop/Tether/docs/SUBMISSION-ANTHROPIC.md) for Claude Desktop plugin and Anthropic registry listing.
  - Follow [docs/SUBMISSION-OPENAI.md](file:///c:/Users/acer/Desktop/Tether/docs/SUBMISSION-OPENAI.md) for ChatGPT custom action / GPT store connector.
- **Beta Tester Onboarding**: Refer to [docs/BETA-TESTING.md](file:///c:/Users/acer/Desktop/Tether/docs/BETA-TESTING.md) to distribute unpackaged developer builds to early adopters.
- **Community Channels**:
  - Announce on GitHub Discussions.
  - Publish release notes from [docs/RELEASE.md](file:///c:/Users/acer/Desktop/Tether/docs/RELEASE.md).
