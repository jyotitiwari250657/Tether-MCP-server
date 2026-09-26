/**
 * Daemon HTTP Server (PRD FR-301, TRD §7.2, Prompt 09-FIX-04).
 * Serves /healthz, /readyz, /metrics, /version, and handles MCP streamable HTTP at /mcp.
 */

import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { ToolProfile } from '@tether/protocol';
import { McpHttpHandler } from '../mcp/http.js';
import type { ToolDispatcher } from '../router/dispatch.js';
import { getHealthz, getMetricsPrometheus, getReadyz, getVersion } from './health.js';

export interface HttpServerOptions {
  port?: number | undefined;
  host?: string | undefined;
  token?: string | undefined;
  config?: unknown;
  dispatcher?: ToolDispatcher | undefined;
  profile?: ToolProfile | undefined;
}

export class DaemonHttpServer {
  readonly port: number;
  readonly host: string;
  private server: Server | null = null;
  readonly mcpHandler: McpHttpHandler | null = null;

  constructor(opts: HttpServerOptions | number = 18796) {
    if (typeof opts === 'number') {
      this.port = opts;
    } else {
      this.port = opts.port ?? 18796;
      if (opts.dispatcher) {
        this.mcpHandler = new McpHttpHandler({
          dispatcher: opts.dispatcher,
          profile: opts.profile,
        });
      }
    }
    this.host = '127.0.0.1'; // strictly loopback
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch((err) => {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Internal Server Error: ${err instanceof Error ? err.message : String(err)}`);
          }
        });
      });

      this.server.listen(this.port, this.host, () => {
        resolve();
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${this.host}:${this.port}`);

    if (url.pathname === '/healthz' || url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getHealthz()));
      return;
    }

    if (url.pathname === '/readyz') {
      const ready = getReadyz();
      res.writeHead(ready.ready ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ready));
      return;
    }

    if (url.pathname === '/version') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getVersion()));
      return;
    }

    if (url.pathname === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
      res.end(getMetricsPrometheus());
      return;
    }

    if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      if (this.mcpHandler) {
        await this.mcpHandler.handleRequest(req, res);
      } else {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'MCP dispatcher not configured' }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  async close(): Promise<void> {
    if (this.mcpHandler) {
      await this.mcpHandler.close();
    }
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
        this.server = null;
      } else {
        resolve();
      }
    });
  }
}
