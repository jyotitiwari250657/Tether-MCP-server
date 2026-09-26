// @vitest-environment node
/**
 * Session Lifecycle Tests (PRD FR-108, FR-109, TRD §6.1, §6.3).
 * Verifies session initialization, termination, SW state rehydration, and client counts.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { clearAuditChain, list as listAudit } from '../../lib/audit/index.js';
import {
  endSession,
  getActiveSession,
  getAttachedClients,
  isPowerMode,
  rehydrate,
  setAttachedClients,
  setPowerMode,
  startSession,
} from '../../lib/session/lifecycle.js';

describe('Session Lifecycle & State (PRD FR-108, TRD §6.1)', () => {
  const sessionStore: Record<string, unknown> = {};

  beforeEach(async () => {
    for (const k of Object.keys(sessionStore)) delete sessionStore[k];
    await clearAuditChain();
    await endSession();

    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        session: {
          get: vi.fn(async (key: string | string[]) => {
            if (Array.isArray(key)) {
              const res: Record<string, unknown> = {};
              for (const k of key) res[k] = sessionStore[k];
              return res;
            }
            return { [key]: sessionStore[key] };
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(sessionStore, items);
          }),
          remove: vi.fn(async (key: string) => {
            delete sessionStore[key];
          }),
        },
      },
    };
  });

  test('FR-108: startSession and endSession manage session lifecycle and audit entries', async () => {
    const session = await startSession({
      id: 'agent-1',
      label: 'Agent 1',
      scopes: ['browser:read', 'browser:write'],
    });

    expect(session.id).toBeDefined();
    expect(getActiveSession()?.id).toBe(session.id);
    expect(getAttachedClients()).toBe(1);

    const auditsStart = await listAudit();
    expect(auditsStart.some((e) => e.tool === 'session.start')).toBe(true);

    await endSession('done');
    expect(getActiveSession()).toBeNull();
    expect(getAttachedClients()).toBe(0);

    const auditsEnd = await listAudit();
    expect(auditsEnd.some((e) => e.tool === 'session.end')).toBe(true);
  });

  test('FR-108: rehydrate restores active session and client state from storage', async () => {
    sessionStore['sw:state'] = {
      v: 1,
      activeSessionId: 'sess-saved',
      attachedClients: 3,
      powerMode: true,
      policyVersion: '1.0.0',
    };
    sessionStore['sw:session'] = {
      id: 'sess-saved',
      client: { id: 'c1', label: 'C1', scopes: ['browser:read'] },
      mode: 'local',
      startedAt: Date.now(),
      steps: 5,
      tokensUsed: 100,
      pendingSteps: 0,
    };

    const rehydrated = await rehydrate();
    expect(rehydrated.v).toBe(1);
    expect(getAttachedClients()).toBe(3);
    expect(isPowerMode()).toBe(true);
    expect(getActiveSession()?.id).toBe('sess-saved');
  });

  test('FR-108: rehydrate returns defaults on empty or corrupt storage', async () => {
    sessionStore['sw:state'] = { v: 2 }; // Incompatible version
    const def = await rehydrate();
    expect(def.v).toBe(1);
    expect(def.attachedClients).toBe(0);
  });

  test('TRD §6.3: setAttachedClients and setPowerMode update local state', () => {
    setAttachedClients(5);
    expect(getAttachedClients()).toBe(5);

    setPowerMode(true);
    expect(isPowerMode()).toBe(true);

    setPowerMode(false);
    expect(isPowerMode()).toBe(false);
  });
});
