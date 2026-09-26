# Tether Directory Conformance Report

> Generated: 2026-09-26T13:53:24.930Z
> Target Platforms: Anthropic Connector Directory (PRD §12.4), OpenAI Plugin Registry (PRD §12.5)

---

## 1. Executive Summary

Tether is a private, local-first browser connector exposing a frozen 40-tool surface across two primary profiles (`browser-readonly` and `browser-act`).
All tools and endpoints have been verified against OAuth 2.1, RFC 9728, RFC 8414, and Model Context Protocol specifications.

- **Total Published Tools:** 40
- **Readonly Profile Tool Budget:** ~2472 tokens
- **Action Profile Tool Budget:** ~4318 tokens
- **Total Tool Surface Budget:** ~4318 tokens

---

## 2. Anthropic Connector Directory Checklist (PRD §12.4)

| Requirement | Implementation Detail | Status | Reference Test |
|---|---|---|---|
| **Public HTTPS `/mcp`** | Streamable HTTP endpoint hosted on Cloudflare Workers / Vercel Edge | PASS | `apps/relay/test/routes/mcp.spec.ts` |
| **Streamable HTTP** | Full JSON-RPC 2.0 streaming with SSE & chunked transfer | PASS | `apps/relay/test/routes/mcp.spec.ts` |
| **OAuth 2.1 + PKCE** | Strict S256 code challenge required, client secret omitted for public clients | PASS | `apps/relay/test/routes/oauth.spec.ts` |
| **RFC 9728 / 8414 / 7591** | Standard discovery and Dynamic Client Registration | PASS | `apps/relay/test/routes/wellknown.spec.ts` |
| **Tool Annotations** | `readOnlyHint`, `destructiveHint`, `openWorldHint`, `idempotentHint` | PASS | `packages/protocol/src/tools/index.ts` |
| **401 Discovery Contract** | Unauthenticated requests return `WWW-Authenticate: Bearer resource_metadata=...` | PASS | `apps/relay/test/routes/mcp.spec.ts` |
| **Anthropic IP Reachability** | Open public ingress on relay without IP filtering | PASS | Production ingress policy |
| **Stability During Review** | Schemas are additive-only (PRD HR-5); frozen protocol package | PASS | `packages/protocol/package.json` |

---

## 3. OpenAI Plugin & Action Registry Checklist (PRD §12.5)

| Requirement | Implementation Detail | Status | Reference Test |
|---|---|---|---|
| **Public HTTPS `/mcp`** | TLS 1.3 encrypted endpoint with strict transport security | PASS | `apps/relay/test/routes/mcp.spec.ts` |
| **Domain Verification** | `/.well-known/openai-domain-verification` and DNS verification TXT records | PASS | Static asset deployment |
| **OAuth 2.1 Refresh** | Long-lived refresh tokens with rotation and `offline_access` scope | PASS | `apps/relay/test/routes/oauth.spec.ts` |
| **Metrics on Failed Init** | Prometheus-compatible logging and error diagnostics on initialization | PASS | `apps/relay/src/middleware/logging.ts` |
| **Backward Compatibility** | Frozen protocol schema; new fields optional only (HR-5) | PASS | Architectural guarantee |
| **Accurate Tool Metadata** | Description strings < 200 chars, exact parameter types, no bare types | PASS | `packages/protocol/src/tools/index.ts` |
| **Front-Loaded Instructions** | Session preamble instructs model on ref resolution and T2 approvals | PASS | Extension side panel session |

---

## 4. Conformance Test Suite Matrix

- **RFC-9728:** Protected Resource Metadata at /.well-known/oauth-protected-resource
  - Status: `VERIFIED`
  - Source: `apps/relay/test/routes/wellknown.spec.ts`

- **RFC-8414:** Authorization Server Metadata at /.well-known/oauth-authorization-server
  - Status: `VERIFIED`
  - Source: `apps/relay/test/routes/wellknown.spec.ts`

- **RFC-7591:** Dynamic Client Registration (DCR) via POST /oauth/register
  - Status: `VERIFIED`
  - Source: `apps/relay/test/routes/oauth.spec.ts`

- **CIMD:** Client ID Metadata Document verification at /.well-known/client-metadata.json
  - Status: `VERIFIED`
  - Source: `apps/relay/test/routes/wellknown.spec.ts`

- **OAUTH-2.1:** OAuth 2.1 Authorization Code Flow with S256 PKCE & Refresh Tokens
  - Status: `VERIFIED`
  - Source: `apps/relay/test/routes/oauth.spec.ts`

- **MCP-HTTP:** Streamable HTTP transport at /mcp with Bearer token authentication
  - Status: `VERIFIED`
  - Source: `apps/relay/test/routes/mcp.spec.ts`

- **MCP-401:** 401 Unauthorized with WWW-Authenticate header initiating discovery flow
  - Status: `VERIFIED`
  - Source: `apps/relay/test/routes/mcp.spec.ts`

- **REVOCATION:** Token revocation support via POST /oauth/revoke
  - Status: `VERIFIED`
  - Source: `apps/relay/test/routes/oauth.spec.ts`

---

## 5. Frozen Tool Catalogue (40 Tools)

| Tool Name | Profile(s) | Tier | Annotations (RO / D / OW / Idem) | Description |
|---|---|---|---|---|
| `browser_snapshot` | browser-readonly, browser-act | 0 | RO Idem | Capture DOM a11y tree snapshot with refs. |
| `browser_get_text` | browser-readonly, browser-act | 0 | RO Idem | Get readable text from ref or selector. |
| `browser_screenshot` | browser-readonly, browser-act | 0 | RO Idem | Capture page or element screenshot. |
| `browser_list_tabs` | browser-readonly, browser-act | 0 | RO Idem | List open browser tabs. |
| `browser_find` | browser-readonly, browser-act | 0 | RO Idem | Find element refs matching query. |
| `browser_read_console` | browser-readonly, browser-act | 0 | RO Idem | Read browser console messages. |
| `browser_list_network` | browser-readonly, browser-act | 0 | RO OW Idem | List page network requests. |
| `browser_extract` | browser-readonly, browser-act | 0 | RO Idem | Extract structured data using schema. |
| `search` | browser-readonly, browser-act | 0 | RO OW Idem | Search company knowledge or web. |
| `fetch` | browser-readonly, browser-act | 0 | RO OW Idem | Fetch URL content as markdown. |
| `browser_click` | browser-act | 1 |  | Click element by ref. |
| `browser_scroll` | browser-act | 1 | Idem | Scroll page or element. |
| `browser_hover` | browser-act | 1 | Idem | Hover over element by ref. |
| `browser_drag` | browser-act | 1 |  | Drag element from ref to ref. |
| `browser_type` | browser-act | 1 |  | Type text into element. |
| `browser_fill_form` | browser-act | 1 |  | Fill multiple form fields. If secretId is present, value is ignored. |
| `browser_select` | browser-act | 1 | Idem | Select dropdown option by value or label. |
| `browser_press_key` | browser-act | 1 |  | Press key combination. |
| `browser_type_secret` | browser-act | 2 | D  | Type secret credential into field. |
| `browser_navigate` | browser-act | 1 | OW Idem | Navigate tab to URL. |
| `browser_wait_for` | browser-act | 1 | RO Idem | Wait for text or selector on page. |
| `browser_tabs` | browser-act | 1 | D  | Manage browser tabs. |
| `browser_submit` | browser-act | 2 | D  | Submit form by ref with confirm token. |
| `browser_dialog` | browser-act | 2 | D  | Accept or dismiss dialog. |
| `browser_download` | browser-act | 2 | D OW  | Download file from page. |
| `browser_upload` | browser-act | 2 | D  | Upload file to input element. |
| `browser_task_start` | browser-act | 1 |  | Start async task and get taskId. |
| `browser_task_status` | browser-act | 1 | RO Idem | Check status of async task. |
| `policy_get` | browser-readonly, browser-act | 3 | RO Idem | Get policy rules for domain. |
| `policy_grant` | browser-readonly, browser-act | 3 |  | Request capability grant for domain. |
| `policy_revoke` | browser-readonly, browser-act | 3 | D Idem | Revoke capability grant. |
| `ask_user` | browser-readonly, browser-act | 3 | RO  | Ask user a question. |
| `confirm_action` | browser-readonly, browser-act | 3 |  | Request user confirmation with diff. |
| `session_pause` | browser-readonly, browser-act | 3 | Idem | Pause automation session. |
| `session_resume` | browser-readonly, browser-act | 3 | Idem | Resume automation session. |
| `session_abort` | browser-readonly, browser-act | 3 | D Idem | Abort automation session. |
| `session_status` | browser-readonly, browser-act | 3 | RO Idem | Get session status. |
| `audit_export` | browser-readonly, browser-act | 3 | RO Idem | Export audit log entries. |
| `site_tools_list` | browser-readonly, browser-act | 2 | RO Idem | List site WebMCP tools. |
| `site_tools_call` | browser-readonly, browser-act | 2 | D OW  | Call site WebMCP tool. |
