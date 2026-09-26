// @vitest-environment node
/**
 * Policy Store Tests (PRD FR-501..FR-505, HR-2).
 * Verifies rule persistence, session vs persistent scoping, grant, revoke, and list.
 */

import type { PolicyRule } from '@tether/protocol';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { grant, listRules, load, revoke, save } from '../../lib/policy/store.js';

describe('Policy Store Persistence (PRD FR-501, HR-2)', () => {
  const localStorage: Record<string, unknown> = {};
  const sessionStorage: Record<string, unknown> = {};

  beforeEach(() => {
    for (const k of Object.keys(localStorage)) delete localStorage[k];
    for (const k of Object.keys(sessionStorage)) delete sessionStorage[k];

    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: localStorage[key] })),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(localStorage, items);
          }),
        },
        session: {
          get: vi.fn(async (key: string) => ({ [key]: sessionStorage[key] })),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(sessionStorage, items);
          }),
        },
      },
    };
  });

  test('FR-501: load returns empty store when no rules saved', async () => {
    const store = await load();
    expect(store.rules).toEqual([]);
    expect(store.version).toBe('1.0.0');
  });

  test('FR-501, HR-2: save separates persistent and session scoped rules', async () => {
    const rPersist: PolicyRule = {
      id: 'r1',
      match: { kind: 'exact', value: 'example.com' },
      level: 'WRITE',
      scope: 'persistent',
      actor: 'user',
      createdAt: Date.now(),
    };
    const rSession: PolicyRule = {
      id: 'r2',
      match: { kind: 'exact', value: 'temp.com' },
      level: 'READ',
      scope: 'session',
      actor: 'user',
      createdAt: Date.now(),
    };

    await save({ rules: [rPersist, rSession], version: '1.0.0' });

    const loaded = await load();
    expect(loaded.rules.length).toBe(2);
    expect(loaded.rules.some((r) => r.id === 'r1')).toBe(true);
    expect(loaded.rules.some((r) => r.id === 'r2')).toBe(true);
  });

  test('FR-501: grant adds new rule and replaces existing rule for same domain', async () => {
    const r1: PolicyRule = {
      id: 'r1',
      match: { kind: 'exact', value: 'example.com' },
      level: 'READ',
      scope: 'persistent',
      actor: 'user',
      createdAt: Date.now(),
    };
    await grant(r1);

    let rules = await listRules();
    expect(rules.length).toBe(1);
    expect(rules[0]?.level).toBe('READ');

    // Overwrite with WRITE rule
    const r2: PolicyRule = {
      id: 'r2',
      match: { kind: 'exact', value: 'example.com' },
      level: 'WRITE',
      scope: 'persistent',
      actor: 'user',
      createdAt: Date.now(),
    };
    await grant(r2);

    rules = await listRules();
    expect(rules.length).toBe(1);
    expect(rules[0]?.id).toBe('r2');
    expect(rules[0]?.level).toBe('WRITE');
  });

  test('FR-501: revoke removes rule by domain pattern', async () => {
    await grant({
      id: 'r1',
      match: { kind: 'exact', value: 'remove-me.com' },
      level: 'DENY',
      scope: 'persistent',
      actor: 'user',
      createdAt: Date.now(),
    });
    await grant({
      id: 'r2',
      match: { kind: 'exact', value: 'keep-me.com' },
      level: 'READ',
      scope: 'persistent',
      actor: 'user',
      createdAt: Date.now(),
    });

    let rules = await listRules();
    expect(rules.length).toBe(2);

    await revoke('remove-me.com');
    rules = await listRules();
    expect(rules.length).toBe(1);
    expect(rules[0]?.match.value).toBe('keep-me.com');
  });
});
