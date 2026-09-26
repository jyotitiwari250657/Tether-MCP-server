# Tether Daemon

Local native background service for Tether (PRD FR-301..310, TRD §7).

## Endpoints

- WebSocket: `ws://127.0.0.1:18795` (extension transport bridge)
- HTTP / MCP: `http://127.0.0.1:18796` (health, metrics, and MCP Streamable HTTP)
  - `GET /healthz`, `GET /readyz`, `GET /version`, `GET /metrics`
  - `POST /mcp`, `GET /mcp`, `DELETE /mcp`, `OPTIONS /mcp` (MCP Streamable HTTP)

## Security Notes

### Loopback-Scoped CORS (SEC-07)
The `/mcp` Streamable HTTP endpoint enforces strict loopback-scoped CORS:
- Requests with an `Origin` matching `^https?://(127\.0\.0\.1|\[::1\]|localhost)(:\d+)?$` receive echoed CORS headers:
  - `Access-Control-Allow-Origin: <origin>`
  - `Vary: Origin`
  - `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`
  - `Access-Control-Allow-Headers: content-type, accept, authorization, mcp-session-id, last-event-id`
  - `Access-Control-Expose-Headers: mcp-session-id`
- Foreign / remote origins (e.g., `https://evil.example`) receive NO CORS headers, preventing malicious web pages from accessing local browser automation tools.
- Operational endpoints (`/healthz`, `/readyz`, etc.) emit no CORS headers.
- Policy evaluation in the extension and user T2 confirmations remain the authoritative security boundary (TRD §2.3).
