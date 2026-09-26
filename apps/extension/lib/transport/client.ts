/**
 * WebSocket Transport Client (TRD §6.11, PRD FR-401..FR-405).
 * Connects to the local daemon, supports loopback bootstrap handshake,
 * applies mandatory redaction to outbound messages, and manages reconnection.
 */

import type { EnvelopeType, HelloAckPayload, Req, Res, ToolError } from '@tether/protocol';
import { redact } from '../redact/index.js';
import { withTimeout } from '../session/target.js';
import { clearReconnectAlarm, ensureReconnectAlarm } from './alarm.js';
import { makeHelloEnvelope, makeInboundResErr, makeKillEnvelope } from './envelopes.js';
import { INTERNAL_HANDLER_HINT, normalizeToolError } from './errors.js';
import { EventEmitterBase } from './event-emitter.js';
import { BoundedQueue } from './queue.js';
import { loadDaemonPort, loadStoredToken, saveStoredToken } from './storage.js';

export type TransportState = 'idle' | 'connecting' | 'online' | 'backoff' | 'closed';

export interface TransportConfig {
  url: string;
  token: string;
}

export class TransportClient extends EventEmitterBase {
  private ws: WebSocket | null = null;
  private _state: TransportState = 'idle';
  private config: TransportConfig | null = null;
  private currentUrl = 'ws://127.0.0.1:18795';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectingPromise: Promise<void> | null = null;
  private readonly queue = new BoundedQueue<EnvelopeType>(64);
  private readonly pendingRequests = new Map<
    string,
    {
      resolve: (res: Res) => void;
      reject: (err: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private requestHandler?: ((req: Req) => Promise<Res>) | undefined;

  setRequestHandler(handler: (req: Req) => Promise<Res>): void {
    this.requestHandler = handler;
  }

  get state(): TransportState {
    return this._state;
  }

  async ensureConnected(opts?: { url?: string }): Promise<void> {
    if (this._state === 'connecting' || this._state === 'online') return;
    if (this.connectingPromise) return this.connectingPromise;

    this.emitState('connecting');
    console.log('[Tether] transport: connecting');
    this.clearReconnectTimer();

    const targetUrl = opts?.url ?? this.config?.url ?? this.currentUrl;
    this.currentUrl = targetUrl;

    this.connectingPromise = (async () => {
      try {
        const storedToken = await loadStoredToken();
        if (this._state !== 'connecting') return;
        // Prompt 12 §1b (AC-P12-02): e2e harness publishes an ephemeral daemon
        // port; normal users get null here and keep the default loopback URL.
        const e2ePort = await loadDaemonPort();
        const effectiveUrl = e2ePort ? `ws://127.0.0.1:${e2ePort}` : targetUrl;
        this.currentUrl = effectiveUrl;
        this.openSocket(effectiveUrl, storedToken);
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  connect(cfg: TransportConfig): void {
    if (this._state === 'connecting' || this._state === 'online') return;
    this.config = cfg;
    this.currentUrl = cfg.url;
    this.emitState('connecting');
    console.log('[Tether] transport: connecting');
    this.clearReconnectTimer();
    this.openSocket(cfg.url, cfg.token);
  }

  private openSocket(url: string, token: string | null): void {
    try {
      try {
        this.ws?.close();
      } catch {}
      const socket = new WebSocket(url);
      this.ws = socket;

      socket.onopen = () => {
        this.rawSend(makeHelloEnvelope(token));
      };

      socket.onmessage = (event: MessageEvent) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : '';
          const msg = JSON.parse(raw) as EnvelopeType;
          void this.handleIncoming(msg);
        } catch {}
      };

      socket.onclose = (event: CloseEvent) => {
        if (this._state === 'connecting' || event.code === 4001) {
          console.warn('[Tether] transport: handshake rejected by daemon');
        }
        if (this._state !== 'closed') this.scheduleReconnect();
      };

      socket.onerror = () => {
        if (this._state !== 'closed') socket.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private async handleIncoming(msg: EnvelopeType): Promise<void> {
    // Prompt 11 §2: daemon-internal OCR result messages carry {type:'ocr.result'}
    // instead of a `kind` field. Dispatch them as a named event for the OCR
    // client; unknown-type messages remain ignored (forward compatibility).
    const msgType = (msg as { type?: string }).type;
    if (msgType === 'ocr.result') {
      this.emit('ocr.result', msg);
      return;
    }
    if (msg.kind === 'evt') {
      if (msg.evt === 'hello-ack') {
        const ack = msg.payload as HelloAckPayload | undefined;
        if (ack?.token) {
          console.log('[Tether] bootstrap token received');
          await saveStoredToken(ack.token);
          this.config = { url: this.currentUrl, token: ack.token };
        }
        console.log('[Tether] transport: online');
        this.reconnectAttempt = 0;
        this.clearReconnectTimer();
        clearReconnectAlarm();
        this.emitState('online');
        this.flushQueue();
      }
      this.emit(msg.evt, msg.payload);
    } else if (msg.kind === 'res') {
      const pending = this.pendingRequests.get(msg.reqId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(msg.reqId);
        pending.resolve(msg);
      }
    } else if (msg.kind === 'req') {
      void this.handleIncomingRequest(msg as Req);
    }
  }

  private async handleIncomingRequest(req: Req): Promise<void> {
    const budgetMs = Math.min(req.budgetMs ?? 20000, 20000);
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const timeoutErr: ToolError = {
      code: 'TIMEOUT',
      message: `Tool request "${req.tool}" timed out after ${budgetMs}ms`,
      hint: 'Extension-side budget exceeded; retry or use browser_task_start.',
      retryable: true,
    };
    try {
      if (!this.requestHandler) throw new Error('No extension request handler registered');
      const res = await withTimeout(this.requestHandler(req), budgetMs, timeoutErr);
      this.send(res);
    } catch (err: unknown) {
      this.send(makeInboundResErr(req, normalizeToolError(err, INTERNAL_HANDLER_HINT), start));
    }
  }

  private rawSend(env: EnvelopeType): void {
    if (this.ws && this.ws.readyState === 1) {
      const { redacted } = redact(env);
      this.ws.send(JSON.stringify(redacted));
    }
  }

  send(env: EnvelopeType): void {
    if (this._state === 'online' && this.ws && this.ws.readyState === 1) {
      this.rawSend(env);
    } else {
      this.queue.push(env);
    }
  }

  /**
   * Sends a daemon-internal control message ({type:...}, no `kind` field),
   * e.g. the user-gesture reset_kill_switch (Prompt 12 AC-P12-01, HR-10).
   * Returns false when the socket is not online — control messages are never
   * queued, because a stale control message would be a lie about user intent.
   */
  sendControl(message: Record<string, unknown>): boolean {
    if (this._state === 'online' && this.ws && this.ws.readyState === 1) {
      try {
        const { redacted } = redact(message);
        this.ws.send(JSON.stringify(redacted));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  private flushQueue(): void {
    while (this.queue.size() > 0 && this.ws && this.ws.readyState === 1) {
      const item = this.queue.pop();
      if (item) this.rawSend(item);
    }
  }

  async request(tool: string, args: unknown, budgetMs = 30000): Promise<Res> {
    const id = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `req-${Date.now()}`;
    const req: Req = {
      v: 1,
      id,
      session: 'session',
      ts: Date.now(),
      kind: 'req',
      tool,
      args,
      token: this.config?.token ?? '',
      idem: id,
      budgetMs: Math.min(30000, Math.max(1, budgetMs)),
    };
    return new Promise<Res>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Tool request "${tool}" timed out after ${budgetMs}ms`));
      }, budgetMs);
      this.pendingRequests.set(id, { resolve, reject, timer });
      this.send(req);
    });
  }

  private emitState(state: TransportState): void {
    this._state = state;
    this.emit('transport.state', { state });
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        void chrome.runtime.sendMessage({ type: 'transport.state', state });
      } catch {}
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const base = Math.min(15000, 250 * 2 ** this.reconnectAttempt);
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.reconnectAttempt++;
    console.log(`[Tether] transport: backoff ${delay}ms`);
    this.emitState('backoff');
    ensureReconnectAlarm();
    this.reconnectTimer = setTimeout(() => {
      if (this._state !== 'closed') void this.ensureConnected();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  close(reason = 'user_close'): void {
    this.clearReconnectTimer();
    clearReconnectAlarm();
    this.emitState('closed');
    const socket = this.ws;
    this.ws = null;
    this.queue.clear();
    if (socket && socket.readyState === 1) {
      try {
        const { redacted } = redact(makeKillEnvelope(reason));
        socket.send(JSON.stringify(redacted));
        socket.close(reason.includes('kill') ? 4002 : 1000, reason.slice(0, 100));
      } catch {
        try {
          socket.close();
        } catch {}
      }
    }
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`Transport closed: ${reason}`));
    }
    this.pendingRequests.clear();
  }
}
