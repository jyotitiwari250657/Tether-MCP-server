import type { Req, Res } from '@tether/protocol';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolDispatcher } from '../../src/router/dispatch.js';
import { SessionLock } from '../../src/router/session.js';
import type { DaemonWsServer } from '../../src/server/ws.js';
import type { VaultService } from '../../src/vault/service.js';

describe('Daemon Router & Session Concurrency (TRD §7.4)', () => {
  it('serializes executions within the same session', async () => {
    const lock = new SessionLock();
    const executionOrder: number[] = [];

    const task1 = lock.acquire('sess-1', async () => {
      await new Promise((r) => setTimeout(r, 30));
      executionOrder.push(1);
    });

    const task2 = lock.acquire('sess-1', async () => {
      executionOrder.push(2);
    });

    await Promise.all([task1, task2]);
    expect(executionOrder).toEqual([1, 2]);
  });

  it('allows parallel executions across different sessions', async () => {
    const lock = new SessionLock();
    const executionOrder: number[] = [];

    const task1 = lock.acquire('sess-a', async () => {
      await new Promise((r) => setTimeout(r, 40));
      executionOrder.push(1);
    });

    const task2 = lock.acquire('sess-b', async () => {
      executionOrder.push(2);
    });

    await Promise.all([task1, task2]);
    // Task 2 should finish first because it does not wait
    expect(executionOrder).toEqual([2, 1]);
  });

  describe('ToolDispatcher', () => {
    let mockWs: Partial<DaemonWsServer>;
    let mockVault: Partial<VaultService>;
    let dispatcher: ToolDispatcher;

    beforeEach(() => {
      mockWs = {
        isExtensionConnected: vi.fn().mockReturnValue(true),
        sendRequest: vi.fn().mockResolvedValue({
          v: 1,
          id: 'res-1',
          session: 's-1',
          ts: Date.now(),
          kind: 'res',
          reqId: 'req-1',
          ok: true,
          result: { success: true },
          ms: 10,
        } as Res),
      };

      mockVault = {
        listSecrets: vi
          .fn()
          .mockResolvedValue([
            { secretId: 'sec-1', label: 'Test', kind: 'api_key', createdAt: 0, lastUsedAt: 0 },
          ]),
        resolveSecret: vi.fn().mockResolvedValue({
          encryptedHex: 'aabb',
          nonceHex: 'ccdd',
          serverEphemeralPubHex: 'eeff',
        }),
      };

      dispatcher = new ToolDispatcher({
        wsServer: mockWs as DaemonWsServer,
        vaultService: mockVault as VaultService,
      });
    });

    it('dispatches tool calls to ws server with single-driver serialization', async () => {
      const res = await dispatcher.dispatchTool('browser_click', { ref: 'ref-1' });
      expect(res.ok).toBe(true);
      expect(mockWs.sendRequest).toHaveBeenCalled();
    });

    it('handles extension vault.list request locally', async () => {
      const req: Req = {
        v: 1,
        id: 'r-1',
        session: 'vault',
        ts: Date.now(),
        kind: 'req',
        tool: 'vault.list',
        args: {},
        token: '',
        idem: 'r-1',
        budgetMs: 5000,
      };

      const res = await dispatcher.handleExtensionRequest(req);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect((res.result as { secrets: unknown[] }).secrets).toHaveLength(1);
      }
    });

    it('handles extension vault.resolve request locally', async () => {
      const req: Req = {
        v: 1,
        id: 'r-2',
        session: 'vault',
        ts: Date.now(),
        kind: 'req',
        tool: 'vault.resolve',
        args: { secretId: 'sec-1', clientPubHex: '112233' },
        token: '',
        idem: 'r-2',
        budgetMs: 5000,
      };

      const res = await dispatcher.handleExtensionRequest(req);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result).toEqual({
          ciphertextHex: 'aabb',
          nonceHex: 'ccdd',
          daemonPubHex: 'eeff',
        });
      }
    });

    it('returns structured error when vault fails', async () => {
      mockVault.listSecrets = vi.fn().mockRejectedValue(new Error('Keychain locked'));

      const req: Req = {
        v: 1,
        id: 'r-3',
        session: 'vault',
        ts: Date.now(),
        kind: 'req',
        tool: 'vault.list',
        args: {},
        token: '',
        idem: 'r-3',
        budgetMs: 5000,
      };

      const res = await dispatcher.handleExtensionRequest(req);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('INTERNAL');
        expect(res.error.message).toContain('VAULT_LOCKED');
      }
    });

    it('dispatch while socket closed returns DEVICE_OFFLINE in < 100 ms', async () => {
      mockWs.isExtensionConnected = vi.fn().mockReturnValue(false);
      const t0 = Date.now();
      const res = await dispatcher.dispatchTool('browser_click', { ref: 'ref-1' });
      const elapsed = Date.now() - t0;
      expect(elapsed).toBeLessThan(100);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('DEVICE_OFFLINE');
        expect(res.error.hint).toContain('Tether extension is loaded and active');
      }
      expect(mockWs.sendRequest).not.toHaveBeenCalled();
    });

    it('socket close during queued call fast-fails with DEVICE_OFFLINE', async () => {
      let releaseFirstLock: () => void;
      const firstLockPromise = new Promise<void>((r) => {
        releaseFirstLock = r;
      });

      mockWs.sendRequest = vi.fn().mockImplementationOnce(async () => {
        await firstLockPromise;
        return { ok: true } as Res;
      });

      const firstCall = dispatcher.dispatchTool('browser_snapshot', {}, 'sess-queue');

      // Socket disconnects while waiting for session lock
      mockWs.isExtensionConnected = vi.fn().mockReturnValue(false);

      const queuedCall = dispatcher.dispatchTool('browser_click', { ref: 'r1' }, 'sess-queue');

      const queuedRes = await queuedCall;
      expect(queuedRes.ok).toBe(false);
      if (!queuedRes.ok) {
        expect(queuedRes.error.code).toBe('DEVICE_OFFLINE');
      }

      releaseFirstLock!();
      await firstCall;
    });
  });
});
