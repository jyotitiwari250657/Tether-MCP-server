import { describe, expect, it } from 'vitest';
import {
  enqueueDeviceCommand,
  getDevicePresence,
  getDeviceResult,
  isDeviceOnline,
  pollDeviceCommand,
  registerDevicePresence,
  storeDeviceResult,
} from '../../src/state/device-registry.js';
import { checkRateLimit } from '../../src/state/rate-limiter.js';
import {
  createMcpSession,
  getMcpSession,
  lockSessionDriver,
  touchMcpSession,
} from '../../src/state/session-manager.js';

describe('Relay In-Memory State & Coordination', () => {
  describe('DeviceRegistry', () => {
    it('updates device heartbeat and checks online status', async () => {
      expect(await isDeviceOnline('dev-test-reg-1')).toBe(false);

      await registerDevicePresence({
        deviceId: 'dev-test-reg-1',
        pubKey: 'pub-reg-1',
        label: 'Extension Test',
        lastSeen: Date.now(),
      });

      expect(await isDeviceOnline('dev-test-reg-1')).toBe(true);

      const presence = await getDevicePresence('dev-test-reg-1');
      expect(presence?.deviceId).toBe('dev-test-reg-1');
      expect(presence?.label).toBe('Extension Test');
    });

    it('enqueues commands and pops next queued command', async () => {
      await enqueueDeviceCommand('dev-test-reg-2', {
        id: 'cmd-reg-1',
        sessionId: 'sess-reg-1',
        envelope: { ciphertext: 'c1', nonce: 'n1', ephemPubKey: 'p1' },
        createdAt: 1000,
      });

      await enqueueDeviceCommand('dev-test-reg-2', {
        id: 'cmd-reg-2',
        sessionId: 'sess-reg-1',
        envelope: { ciphertext: 'c2', nonce: 'n2', ephemPubKey: 'p2' },
        createdAt: 2000,
      });

      const next1 = await pollDeviceCommand('dev-test-reg-2');
      expect(next1?.id).toBe('cmd-reg-1');

      const next2 = await pollDeviceCommand('dev-test-reg-2');
      expect(next2?.id).toBe('cmd-reg-2');

      const next3 = await pollDeviceCommand('dev-test-reg-2');
      expect(next3).toBeNull();
    });

    it('stores and retrieves command results', async () => {
      await storeDeviceResult('cmd-reg-3', { status: 'success', data: 42 });
      const result = await getDeviceResult<{ status: string; data: number }>('cmd-reg-3');
      expect(result).toEqual({ status: 'success', data: 42 });
    });
  });

  describe('SessionManager', () => {
    it('creates, retrieves, touches, and locks driver on MCP sessions', async () => {
      const session = await createMcpSession('sess-test-mgr-1', 'client-mgr-1', 'dev-mgr-1');
      expect(session.id).toBe('sess-test-mgr-1');

      const retrieved = await getMcpSession('sess-test-mgr-1');
      expect(retrieved?.clientId).toBe('client-mgr-1');

      await touchMcpSession('sess-test-mgr-1');

      // Lock session driver
      const lock1 = await lockSessionDriver('sess-test-mgr-1', 'driver-agent-A');
      expect(lock1.ok).toBe(true);

      // Competing driver lock attempt
      const lock2 = await lockSessionDriver('sess-test-mgr-1', 'driver-agent-B');
      expect(lock2.ok).toBe(false);
      expect(lock2.currentDriver).toBe('driver-agent-A');
    });
  });

  describe('RateLimiter', () => {
    it('enforces sliding window request rate limiting', async () => {
      const key = 'test-rate-limit-sliding';
      const limit = 3;
      const windowSec = 10;

      const r1 = await checkRateLimit(key, limit, windowSec);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = await checkRateLimit(key, limit, windowSec);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = await checkRateLimit(key, limit, windowSec);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);

      const r4 = await checkRateLimit(key, limit, windowSec);
      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
    });
  });
});
