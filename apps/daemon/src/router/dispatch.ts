/**
 * Daemon Tool Dispatcher (PRD FR-301, TRD §7.4, TRD §2.3 Single Point of Policy).
 * Bridges MCP client calls to extension WebSocket and local VaultService.
 */

import type { Req, Res } from '@tether/protocol';
import type { DaemonWsServer } from '../server/ws.js';
import type { VaultService } from '../vault/service.js';
import { SessionLock } from './session.js';

export interface DispatcherOptions {
  wsServer: DaemonWsServer;
  vaultService: VaultService;
}

export class ToolDispatcher {
  private wsServer: DaemonWsServer;
  private vaultService: VaultService;
  private sessionLock = new SessionLock();

  constructor(opts: DispatcherOptions) {
    this.wsServer = opts.wsServer;
    this.vaultService = opts.vaultService;
  }

  /**
   * Handles tool execution initiated from MCP clients.
   */
  async dispatchTool(
    toolName: string,
    args: Record<string, unknown>,
    sessionId = 'mcp-default',
    timeoutMs = 25000,
  ): Promise<Res> {
    const budgetMs = Math.min(timeoutMs, 30000); // HR-9: every tool resolves in < 30s
    const reqId = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    if (this.wsServer.isKillSwitchEngaged?.()) {
      return {
        v: 1,
        id: reqId,
        session: sessionId,
        ts: Date.now(),
        kind: 'res',
        reqId,
        ok: false,
        error: {
          code: 'SESSION_ABORTED',
          message: 'Kill switch is engaged. All actions are aborted.',
          hint: 'The kill switch was activated. Reload or re-enable Tether to continue.',
          retryable: false,
        },
        ms: 1,
      };
    }

    if (!this.wsServer.isExtensionConnected()) {
      return {
        v: 1,
        id: reqId,
        session: sessionId,
        ts: Date.now(),
        kind: 'res',
        reqId,
        ok: false,
        error: {
          code: 'DEVICE_OFFLINE',
          message: 'No Chrome extension is currently connected to the Tether daemon.',
          hint: 'Open Google Chrome and ensure the Tether extension is loaded and active',
          retryable: true,
        },
        ms: 1,
      };
    }

    const req: Req = {
      v: 1,
      id: reqId,
      session: sessionId,
      ts: Date.now(),
      kind: 'req',
      tool: toolName,
      args,
      token: '',
      idem: reqId,
      budgetMs,
    };

    // Serialize calls within the session using the single-driver concurrency lock
    return this.sessionLock.acquire(sessionId, async () => {
      return this.wsServer.sendRequest(req, budgetMs);
    });
  }

  /**
   * Handles requests originating from the Chrome extension (e.g. vault operations).
   */
  async handleExtensionRequest(req: Req): Promise<Res> {
    const startTime = Date.now();

    if (req.tool === 'vault.list') {
      try {
        const secrets = await this.vaultService.listSecrets();
        return {
          v: 1,
          id: req.id,
          session: req.session,
          ts: Date.now(),
          kind: 'res',
          reqId: req.id,
          ok: true,
          result: { secrets },
          ms: Date.now() - startTime,
        };
      } catch (err: unknown) {
        return {
          v: 1,
          id: req.id,
          session: req.session,
          ts: Date.now(),
          kind: 'res',
          reqId: req.id,
          ok: false,
          error: {
            code: 'INTERNAL',
            message: `VAULT_LOCKED: ${err instanceof Error ? err.message : String(err)}`,
            hint: 'The OS keychain is locked or unavailable on this machine',
            retryable: true,
            details: { vaultCode: 'VAULT_LOCKED' },
          },
          ms: Date.now() - startTime,
        };
      }
    }

    if (req.tool === 'vault.resolve') {
      const args = req.args as { secretId?: string; clientPubHex?: string };
      if (!args.secretId || !args.clientPubHex) {
        return {
          v: 1,
          id: req.id,
          session: req.session,
          ts: Date.now(),
          kind: 'res',
          reqId: req.id,
          ok: false,
          error: {
            code: 'SCHEMA_INVALID',
            message: 'secretId and clientPubHex are required for vault.resolve',
            hint: 'Provide secretId and ephemeral clientPubHex',
            retryable: false,
          },
          ms: Date.now() - startTime,
        };
      }

      try {
        const resolved = await this.vaultService.resolveSecret(args.secretId, args.clientPubHex);
        return {
          v: 1,
          id: req.id,
          session: req.session,
          ts: Date.now(),
          kind: 'res',
          reqId: req.id,
          ok: true,
          result: {
            ciphertextHex: resolved.encryptedHex,
            nonceHex: resolved.nonceHex,
            daemonPubHex: resolved.serverEphemeralPubHex,
          },
          ms: Date.now() - startTime,
        };
      } catch (err: unknown) {
        return {
          v: 1,
          id: req.id,
          session: req.session,
          ts: Date.now(),
          kind: 'res',
          reqId: req.id,
          ok: false,
          error: {
            code: 'INTERNAL',
            message: `VAULT_LOCKED: ${err instanceof Error ? err.message : String(err)}`,
            hint: 'Failed to access OS keychain for secret resolution',
            retryable: true,
            details: { vaultCode: 'VAULT_LOCKED' },
          },
          ms: Date.now() - startTime,
        };
      }
    }

    return {
      v: 1,
      id: req.id,
      session: req.session,
      ts: Date.now(),
      kind: 'res',
      reqId: req.id,
      ok: false,
      error: {
        code: 'INTERNAL',
        message: `Unknown daemon tool requested: ${req.tool}`,
        hint: 'Supported daemon tools: vault.list, vault.resolve',
        retryable: false,
      },
      ms: Date.now() - startTime,
    };
  }
}
