/**
 * Daemon Loopback WebSocket Server (PRD FR-301, SEC-07, TRD §7.2).
 * Strictly bound to 127.0.0.1:18795 with Origin check and token authentication.
 */

import { writeFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import type { EnvelopeType, Evt, Req, Res } from '@tether/protocol';
import { type WebSocket, WebSocketServer } from 'ws';
import type { DaemonConfig } from '../config.js';
import { type OcrRedactMessage, type OcrService, handleOcrRedact } from '../ocr/index.js';
import { getTokenPath, loadOrCreateToken, verifyToken } from './auth.js';
import { handleHelloHandshake, recordDaemonAudit } from './bootstrap.js';
import { metrics } from './health.js';
import {
  type OfflineCode,
  internalErrorResponse,
  offlineResponse,
  timeoutResponse,
} from './responses.js';

export interface WsServerOptions {
  port?: number | undefined;
  host?: string | undefined;
  config?: DaemonConfig | undefined;
  token?: string | undefined;
  pinnedExtensionId?: string | undefined;
  onRequest?: ((req: Req) => Promise<Res>) | undefined;
  /** Prompt 11 §2: daemon-internal OCR service for extension screenshots. */
  ocrService?: OcrService | undefined;
}

export class DaemonWsServer {
  readonly port: number;
  readonly host: string;
  readonly pinnedExtensionId?: string | undefined;
  private wss: WebSocketServer | null = null;
  private activeSocket: WebSocket | null = null;
  private pendingRequests: Map<string, (res: Res) => void> = new Map();
  private expectedToken: string;
  private onRequest?: ((req: Req) => Promise<Res>) | undefined;
  private ocrService?: OcrService | undefined;
  private mockRemoteAddress: string | null = null;
  private killSwitchEngaged = false;

  constructor(opts: WsServerOptions = {}) {
    this.port = opts.port ?? 18795;
    this.host = '127.0.0.1'; // strictly locked to loopback (PRD FR-301, SEC-07)
    this.expectedToken = opts.token ?? loadOrCreateToken();
    this.pinnedExtensionId = opts.pinnedExtensionId ?? opts.config?.extensionId ?? undefined;
    this.onRequest = opts.onRequest;
    this.ocrService = opts.ocrService;
  }

  isKillSwitchEngaged(): boolean {
    return this.killSwitchEngaged;
  }

  setMockRemoteAddress(addr: string | null): void {
    this.mockRemoteAddress = addr;
  }

  rotateToken(newToken: string): void {
    this.expectedToken = newToken;
    try {
      writeFileSync(getTokenPath(), newToken, { encoding: 'utf-8', mode: 0o600 });
    } catch {
      // Ignore write errors in test or mock environments
    }
  }

  getToken(): string {
    return this.expectedToken;
  }

  verifyToken(token: string): boolean {
    return verifyToken(token, this.expectedToken);
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer(
          {
            port: this.port,
            host: this.host,
            verifyClient: (info, cb) => {
              const ok = this.verifyClient(info.req);
              cb(ok, ok ? 200 : 403, ok ? 'OK' : 'Forbidden');
            },
          },
          () => {
            resolve();
          },
        );

        this.wss.on('connection', (ws, req) => {
          this.handleConnection(ws, req);
        });

        this.wss.on('error', (err) => {
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private verifyClient(req: IncomingMessage): boolean {
    const origin = (req.headers.origin ?? '').toLowerCase();

    // Must be from a chrome-extension origin
    if (!origin.startsWith('chrome-extension://')) {
      return false;
    }

    // Check token if passed via query string or header
    const authHeader = req.headers.authorization ?? '';
    if (authHeader.startsWith('Bearer ')) {
      const provided = authHeader.slice(7).trim();
      return verifyToken(provided, this.expectedToken);
    }

    // Extension may also authenticate in the hello handshake envelope
    return true;
  }

  private handleConnection(ws: WebSocket, req?: IncomingMessage): void {
    let isAuthenticated = false;
    const origin = (req?.headers?.origin ?? '').toLowerCase().trim();
    const peerAddress = this.mockRemoteAddress ?? req?.socket?.remoteAddress ?? null;
    // If already authenticated via HTTP Authorization header
    const authHeader = req?.headers?.authorization ?? '';
    if (authHeader.startsWith('Bearer ')) {
      const provided = authHeader.slice(7).trim();
      if (verifyToken(provided, this.expectedToken)) {
        isAuthenticated = true;
        this.activeSocket = ws;
        metrics.extensionConnected = true;
        console.log('[Tether] extension connected');
      }
    }

    ws.on('message', (raw) => {
      try {
        const str = raw.toString();
        const env = JSON.parse(str) as EnvelopeType;

        if (env.kind === 'evt' && env.evt === 'kill') {
          this.killSwitchEngaged = true;
          this.rejectPendingRequests('Kill switch engaged', 'SESSION_ABORTED');
          return;
        }

        if (env.kind === 'evt' && env.evt === 'hello') {
          handleHelloHandshake(env, ws, {
            expectedToken: this.expectedToken,
            pinnedExtensionId: this.pinnedExtensionId,
            origin,
            peerAddress,
            onAuthenticated: () => {
              isAuthenticated = true;
              if (!this.activeSocket || this.activeSocket.readyState !== 1) {
                this.activeSocket = ws;
              }
              metrics.extensionConnected = true;
              // Prompt 12 AC-P12-01 (HR-10): an authenticated hello MUST NOT
              // re-arm a killed daemon. Only an explicit user-gesture
              // reset_kill_switch message clears the flag.
            },
            rotateToken: (newToken: string) => {
              this.rotateToken(newToken);
            },
          });
          return;
        }

        if (!isAuthenticated && ws !== this.activeSocket) {
          ws.close(4001, 'Unauthorized');
          return;
        }

        // Prompt 11 §2: daemon-internal OCR redaction service (extension→daemon).
        if ((env as { type?: string }).type === 'ocr.redact') {
          handleOcrRedact(env as unknown as OcrRedactMessage, ws, this.ocrService);
          return;
        }

        // Prompt 12 AC-P12-01 (HR-10): explicit user-gesture reset of the kill
        // switch. Never fired automatically by a reconnect or handshake.
        if ((env as { type?: string }).type === 'reset_kill_switch') {
          this.killSwitchEngaged = false;
          recordDaemonAudit({ tool: 'daemon.reset_kill_switch', verdict: 'allow' });
          console.log('[Tether] kill switch reset by user');
          return;
        }

        if (env.kind === 'req') {
          if (this.onRequest) {
            this.onRequest(env)
              .then((res) => {
                ws.send(JSON.stringify(res));
              })
              .catch((err) => {
                ws.send(JSON.stringify(internalErrorResponse(env, err)));
              });
          }
          return;
        }

        if (env.kind === 'res') {
          const handler = this.pendingRequests.get(env.reqId);
          if (handler) {
            this.pendingRequests.delete(env.reqId);
            handler(env);
          }
        }
      } catch {
        // Ignore malformed wire envelopes
      }
    });

    ws.on('close', (code, reason) => {
      const reasonStr = reason ? reason.toString() : '';
      if (code === 4002 || reasonStr.includes('kill')) this.killSwitchEngaged = true;
      if (this.activeSocket === ws) {
        this.activeSocket = null;
        metrics.extensionConnected = false;
        console.log('[Tether] extension disconnected');
        const errCode = this.killSwitchEngaged ? 'SESSION_ABORTED' : 'DEVICE_OFFLINE';
        this.rejectPendingRequests(
          this.killSwitchEngaged
            ? 'Kill switch engaged'
            : 'Extension connection lost while request was in-flight',
          errCode,
        );
      }
    });
  }

  private rejectPendingRequests(reason: string, code: OfflineCode = 'DEVICE_OFFLINE'): void {
    for (const [id, handler] of this.pendingRequests)
      handler(offlineResponse({ id }, reason, code));
    this.pendingRequests.clear();
  }

  isExtensionConnected(): boolean {
    return this.activeSocket !== null && this.activeSocket.readyState === 1 /* OPEN */;
  }

  async sendRequest(req: Req, timeoutMs = 15000): Promise<Res> {
    if (!this.isExtensionConnected()) {
      return offlineResponse(
        req,
        'No Chrome extension is currently connected to the Tether daemon.',
      );
    }

    metrics.totalRequests++;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(req.id);
        resolve(timeoutResponse(req, timeoutMs));
      }, timeoutMs);

      this.pendingRequests.set(req.id, (res) => {
        clearTimeout(timer);
        resolve(res);
      });

      console.log('[Tether] Daemon sending request to extension:', req.id, req.tool);
      this.activeSocket?.send(JSON.stringify(req));
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.activeSocket) {
        this.activeSocket.close();
        this.activeSocket = null;
      }
      metrics.extensionConnected = false;
      this.rejectPendingRequests('Daemon WebSocket server closed');
      if (this.wss) {
        this.wss.close(() => resolve());
        this.wss = null;
      } else resolve();
    });
  }
}
