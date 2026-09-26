// @vitest-environment node
/**
 * Policy Decision Engine — normative decision steps 5–8 (TRD §6.6.2, PRD FR-501, FR-503,
 * HR-12, SEC-13): sensitive-category default deny, explicit rules, no-rule defaults,
 * cross-origin frame checks. Split from engine.spec.ts for the TRD §4.3 300-line cap.
 */

import type { PolicyRule } from '@tether/protocol';
import { beforeEach, describe, expect, test } from 'vitest';
import { decide } from '../../lib/policy/engine.js';
import type { PolicyContext, PolicyStore } from '../../lib/policy/types.js';
import { createDummyTool } from './helpers.js';

describe('Policy Decision Engine — steps 5-8 (TRD §6.6.2, PRD FR-501/FR-503)', () => {
  let store: PolicyStore;

  beforeEach(() => {
    store = {
      rules: [] as PolicyRule[],
      version: '1.0.0',
    };
  });

  // Step 5: Sensitive category blocklist
  test('FR-503, HR-12: step 5 blocks banking origin by default', () => {
    const ctx: PolicyContext = {
      tool: createDummyTool('browser_snapshot', 0),
      origin: 'https://chase.com',
      tier: 0,
      session: 's-1',
      clientScopes: ['browser:read'],
      powerMode: false,
    };
    const decision = decide(ctx, store);
    expect(decision.verdict).toBe('deny');
    expect(decision.code).toBe('POLICY_DENIED');
  });

  test('FR-503, HR-12: step 5 blocks email origin by default', () => {
    const ctx: PolicyContext = {
      tool: createDummyTool('browser_snapshot', 0),
      origin: 'https://gmail.com',
      tier: 0,
      session: 's-1',
      clientScopes: ['browser:read'],
      powerMode: false,
    };
    const decision = decide(ctx, store);
    expect(decision.verdict).toBe('deny');
    expect(decision.code).toBe('POLICY_DENIED');
  });

  test('FR-503: step 5 allows sensitive origin if explicit user override rule exists', () => {
    store.rules.push({
      id: 'r-user',
      match: { kind: 'exact', value: 'chase.com' },
      level: 'READ',
      scope: 'persistent',
      actor: 'user',
      createdAt: Date.now(),
    });
    const ctx: PolicyContext = {
      tool: createDummyTool('browser_snapshot', 0),
      origin: 'https://chase.com',
      tier: 0,
      session: 's-1',
      clientScopes: ['browser:read'],
      powerMode: false,
    };
    const decision = decide(ctx, store);
    expect(decision.verdict).toBe('allow');
  });

  // Step 6: Explicit rules
  test('FR-501: step 6 handles explicit DENY rule', () => {
    store.rules.push({
      id: 'r-deny',
      match: { kind: 'exact', value: 'malicious.example' },
      level: 'DENY',
      scope: 'persistent',
      actor: 'user',
      createdAt: Date.now(),
    });
    const ctx: PolicyContext = {
      tool: createDummyTool('browser_snapshot', 0),
      origin: 'https://malicious.example',
      tier: 0,
      session: 's-1',
      clientScopes: ['browser:read'],
      powerMode: false,
    };
    const decision = decide(ctx, store);
    expect(decision.verdict).toBe('deny');
    expect(decision.code).toBe('POLICY_DENIED');
  });

  test('FR-501: step 6 allows tier 0 on explicit READ rule and asks on tier 1', () => {
    store.rules.push({
      id: 'r-read',
      match: { kind: 'exact', value: 'docs.example.com' },
      level: 'READ',
      scope: 'persistent',
      actor: 'user',
      createdAt: Date.now(),
    });

    const ctxRead: PolicyContext = {
      tool: createDummyTool('browser_snapshot', 0),
      origin: 'https://docs.example.com',
      tier: 0,
      session: 's-1',
      clientScopes: ['browser:read'],
      powerMode: false,
    };
    expect(decide(ctxRead, store).verdict).toBe('allow');

    const ctxWrite: PolicyContext = {
      tool: createDummyTool('browser_click', 1),
      origin: 'https://docs.example.com',
      tier: 1,
      session: 's-1',
      clientScopes: ['browser:write'],
      powerMode: false,
    };
    expect(decide(ctxWrite, store).verdict).toBe('ask');
  });

  test('FR-501: step 6 allows tier 1 on explicit WRITE rule', () => {
    store.rules.push({
      id: 'r-write',
      match: { kind: 'exact', value: 'app.example.com' },
      level: 'WRITE',
      scope: 'persistent',
      actor: 'user',
      createdAt: Date.now(),
    });

    const ctx: PolicyContext = {
      tool: createDummyTool('browser_click', 1),
      origin: 'https://app.example.com',
      tier: 1,
      session: 's-1',
      clientScopes: ['browser:write'],
      powerMode: false,
    };
    expect(decide(ctx, store).verdict).toBe('allow');
  });

  test('FR-501: step 6 handles explicit ASK and SENSITIVE rules', () => {
    store.rules.push(
      {
        id: 'r-ask',
        match: { kind: 'exact', value: 'ask.example.com' },
        level: 'ASK',
        scope: 'persistent',
        actor: 'user',
        createdAt: Date.now(),
      },
      {
        id: 'r-sens',
        match: { kind: 'exact', value: 'sens.example.com' },
        level: 'SENSITIVE',
        scope: 'persistent',
        actor: 'user',
        createdAt: Date.now(),
      },
    );

    const ctxAsk: PolicyContext = {
      tool: createDummyTool('browser_snapshot', 0),
      origin: 'https://ask.example.com',
      tier: 0,
      session: 's-1',
      clientScopes: ['browser:read'],
      powerMode: false,
    };
    expect(decide(ctxAsk, store).verdict).toBe('ask');

    const ctxSens: PolicyContext = {
      tool: createDummyTool('browser_click', 1),
      origin: 'https://sens.example.com',
      tier: 1,
      session: 's-1',
      clientScopes: ['browser:write'],
      powerMode: false,
    };
    expect(decide(ctxSens, store).verdict).toBe('allow');
  });

  // Step 7: No rule defaults
  test('FR-501: step 7 asks on tier 0, 1, 2 when no rule exists, allows tier 3', () => {
    const base: Omit<PolicyContext, 'tool' | 'tier' | 'clientScopes'> = {
      origin: 'https://fresh.example.com',
      session: 's-1',
      powerMode: false,
    };

    const ctxT0: PolicyContext = {
      ...base,
      tool: createDummyTool('snapshot', 0),
      tier: 0,
      clientScopes: ['browser:read'],
    };
    const resT0 = decide(ctxT0, store);
    expect(resT0.verdict).toBe('ask');
    expect(resT0.reason).toContain('read');

    const ctxT1: PolicyContext = {
      ...base,
      tool: createDummyTool('click', 1),
      tier: 1,
      clientScopes: ['browser:write'],
    };
    const resT1 = decide(ctxT1, store);
    expect(resT1.verdict).toBe('ask');
    expect(resT1.reason).toContain('modify');

    const ctxT2: PolicyContext = {
      ...base,
      tool: createDummyTool('submit', 2),
      tier: 2,
      clientScopes: ['browser:write'],
    };
    const resT2 = decide(ctxT2, store, { confirmToken: 'tok-123' });
    expect(resT2.verdict).toBe('ask');

    const ctxT3: PolicyContext = {
      ...base,
      tool: createDummyTool('gov', 3),
      tier: 3,
      clientScopes: [],
    };
    const resT3 = decide(ctxT3, store);
    expect(resT3.verdict).toBe('allow');
  });

  // Step 8: Cross-origin frame mismatch
  test('SEC-13: step 8 denies when frame grant is lower than top origin grant', () => {
    store.rules.push(
      {
        id: 'r-top',
        match: { kind: 'exact', value: 'top.example.com' },
        level: 'WRITE',
        scope: 'persistent',
        actor: 'user',
        createdAt: Date.now(),
      },
      {
        id: 'r-frame',
        match: { kind: 'exact', value: 'frame.example.com' },
        level: 'READ',
        scope: 'persistent',
        actor: 'user',
        createdAt: Date.now(),
      },
    );

    const ctx: PolicyContext = {
      tool: createDummyTool('browser_click', 1),
      origin: 'https://top.example.com',
      frameOrigin: 'https://frame.example.com',
      tier: 1,
      session: 's-1',
      clientScopes: ['browser:write'],
      powerMode: false,
    };

    const decision = decide(ctx, store);
    expect(decision.verdict).toBe('deny');
    expect(decision.code).toBe('POLICY_DENIED');
    expect(decision.reason).toContain('Cross-origin frame');
  });
});
