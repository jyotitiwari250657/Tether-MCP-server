# @tether/relay — Hosted Relay (Mode B) on Vercel

The Tether Relay acts as a secure, zero-plaintext-at-rest connector bridge between remote AI agent clients (Claude, ChatGPT, etc.) and connected extension devices.

> **License:** MIT, same as the rest of Tether — see the root [`LICENSE`](../../LICENSE). All components are MIT-licensed; there is no open-core boundary.

## Architecture

- **Runtime:** Vercel Serverless Functions (`api/*.ts`) wrapping a modular [Hono](https://hono.dev/) router.
- **Database:** [Neon Postgres](https://neon.tech/) connection-pooled edge database (`@neondatabase/serverless`).
- **State & Caching:** [Vercel KV](https://vercel.com/docs/storage/vercel-kv) (Upstash Redis) for active device tracking, session locks, rate limiting, and long-poll queue dispatching.
- **Protocol:**
  - Streamable HTTP with Server-Sent Events (SSE) for MCP client streams (`POST /api/mcp`).
  - Device communication via HTTP Long-Polling (`GET /api/device/poll`) and Ingest (`POST /api/device/ingest`).
  - OAuth 2.1 (RFC 9728, RFC 8414, RFC 7591 DCR, PKCE, token rotation & revocation).
  - End-to-end encrypted envelope (X25519 ECDH + HKDF + AES-256-GCM) — relay carries zero plaintext on wire or at rest.

## Configuration & Timeouts

### `LONG_POLL_TIMEOUT_MS`
Controls the maximum duration that `GET /api/device/poll` will hold an HTTP connection waiting for new client commands:
- **Managed Hobby (`RELAY_MODE='managed'`):** Defaults to `8000` ms (8 seconds) to comfortably stay within Vercel Hobby's 10-second serverless execution limit.
- **Managed Pro/Enterprise or Self-Host (`RELAY_MODE='selfhost'`):** Defaults to `25000` ms (25 seconds).
- Can be overridden explicitly via the `LONG_POLL_TIMEOUT_MS` environment variable.

## Self-Hosting Parity (FR-608)

Setting `RELAY_MODE=selfhost` allows running this exact same codebase with a standard Postgres database and Redis instance without Vercel-specific dependencies, defaulting audit and metadata retention to 0 days.
