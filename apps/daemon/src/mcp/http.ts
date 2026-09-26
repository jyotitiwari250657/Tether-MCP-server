/**
 * Daemon MCP Streamable HTTP Transport Handler (PRD FR-301, TRD §7.3, Prompt 09-FIX-04).
 * Handles POST/GET/DELETE/OPTIONS at /mcp with loopback-scoped CORS and session management.
 */

import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { ToolProfile } from '@tether/protocol';
import type { ToolDispatcher } from '../router/dispatch.js';
import { recordDaemonAudit } from '../server/bootstrap.js';
import { TetherMcpServer } from './server.js';

export const LOOPBACK_ORIGIN_REGEX = /^https?:\/\/(127\.0\.0\.1|\[::1\]|localhost)(:\d+)?$/;

export function applyCorsHeaders(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && LOOPBACK_ORIGIN_REGEX.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'content-type, accept, authorization, mcp-session-id, last-event-id',
    );
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');
    return true;
  }
  return false;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

interface ActiveSession {
  id: string;
  clientName: string;
  server: TetherMcpServer;
  transport: StreamableHTTPServerTransport;
  createdAt: number;
}

export interface McpHttpHandlerOptions {
  dispatcher: ToolDispatcher;
  profile?: ToolProfile | undefined;
}

export class McpHttpHandler {
  private dispatcher: ToolDispatcher;
  private profile?: ToolProfile | undefined;
  private sessions = new Map<string, ActiveSession>();

  constructor(opts: McpHttpHandlerOptions) {
    this.dispatcher = opts.dispatcher;
    this.profile = opts.profile;
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname !== '/mcp' && url.pathname !== '/mcp/') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    if (req.method === 'OPTIONS') {
      applyCorsHeaders(req, res);
      res.writeHead(204);
      res.end();
      return;
    }

    applyCorsHeaders(req, res);

    if (req.method === 'GET') {
      await this.handleGet(req, res);
      return;
    }

    if (req.method === 'DELETE') {
      await this.handleDelete(req, res);
      return;
    }

    if (req.method === 'POST') {
      await this.handlePost(req, res);
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      }),
    );
  }

  private async handleGet(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const session = sessionId ? this.sessions.get(sessionId) : undefined;
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Session not found' },
          id: null,
        }),
      );
      return;
    }

    if (!req.headers.accept || req.headers.accept.includes('*/*')) {
      req.headers.accept = 'text/event-stream';
    }

    await session.transport.handleRequest(req, res);
  }

  private async handleDelete(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const session = sessionId ? this.sessions.get(sessionId) : undefined;
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Session not found' },
          id: null,
        }),
      );
      return;
    }

    console.log(
      `[Tether] mcp.http.session.end: session=${session.id} client=${session.clientName}`,
    );
    recordDaemonAudit({
      tool: 'mcp.http.session.end',
      verdict: 'allow',
      detail: `session=${session.id} client=${session.clientName}`,
    });

    await session.transport.handleRequest(req, res);
    await session.server.server.close();
    if (sessionId) {
      this.sessions.delete(sessionId);
    }
  }

  private async handlePost(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const bodyText = await readBody(req);
    let parsedBody: unknown;
    if (bodyText.trim()) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32700, message: 'Parse error: Invalid JSON' },
            id: null,
          }),
        );
        return;
      }
    }

    const isInit = (Array.isArray(parsedBody) ? parsedBody : [parsedBody]).some(
      (msg) =>
        msg && typeof msg === 'object' && (msg as Record<string, unknown>).method === 'initialize',
    );

    const sessionIdHeader = req.headers['mcp-session-id'] as string | undefined;

    if (isInit) {
      const sessionId = randomUUID();
      const initMsg = (Array.isArray(parsedBody) ? parsedBody : [parsedBody]).find(
        (msg) =>
          msg &&
          typeof msg === 'object' &&
          (msg as Record<string, unknown>).method === 'initialize',
      ) as { params?: { clientInfo?: { name?: string } } } | undefined;
      const clientName = initMsg?.params?.clientInfo?.name ?? 'unknown';

      const mcpServer = new TetherMcpServer({
        dispatcher: this.dispatcher,
        sessionId,
        profile: this.profile,
      });

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
        onsessionclosed: () => {
          this.sessions.delete(sessionId);
        },
      });

      await mcpServer.server.connect(
        transport as unknown as Parameters<typeof mcpServer.server.connect>[0],
      );

      const session: ActiveSession = {
        id: sessionId,
        clientName,
        server: mcpServer,
        transport,
        createdAt: Date.now(),
      };
      this.sessions.set(sessionId, session);

      console.log(`[Tether] mcp.http.session.start: session=${sessionId} client=${clientName}`);
      recordDaemonAudit({
        tool: 'mcp.http.session.start',
        verdict: 'allow',
        detail: `session=${sessionId} client=${clientName}`,
      });

      if (!req.headers.accept || req.headers.accept.includes('*/*')) {
        req.headers.accept = 'application/json, text/event-stream';
      }

      res.setHeader('mcp-session-id', sessionId);

      await transport.handleRequest(req, res, parsedBody);
      return;
    }

    // Non-initialize POST without a valid Mcp-Session-Id -> 404 per MCP spec
    const session = sessionIdHeader ? this.sessions.get(sessionIdHeader) : undefined;
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Session not found' },
          id: null,
        }),
      );
      return;
    }

    if (!req.headers.accept || req.headers.accept.includes('*/*')) {
      req.headers.accept = 'application/json, text/event-stream';
    }

    await session.transport.handleRequest(req, res, parsedBody);
  }

  async close(): Promise<void> {
    for (const session of this.sessions.values()) {
      try {
        await session.transport.close();
        await session.server.server.close();
      } catch {
        // ignore on shutdown
      }
    }
    this.sessions.clear();
  }
}
