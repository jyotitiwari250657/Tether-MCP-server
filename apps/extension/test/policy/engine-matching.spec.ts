// @vitest-environment node
/**
 * Policy Decision Engine — rule matching and banking edge cases (TRD §6.6.2, PRD FR-501,
 * FR-503, HR-8, HR-12). Split from engine.spec.ts for the TRD §4.3 300-line cap.
 */

import type { PolicyRule } from '@tether/protocol';
import { beforeEach, describe, expect, test } from 'vitest';
import { decide } from '../../lib/policy/engine.js';
import type { PolicyContext, PolicyStore } from '../../lib/policy/types.js';
import { createDummyTool } from './helpers.js';

describe('Policy Decision Engine — matching (TRD §6.6.2, PRD FR-501/FR-503)', () => {
  let store: PolicyStore;

  beforeEach(() => {
    store = {
      rules: [] as PolicyRule[],
      version: '1.0.0',
    };
  });

  // Wildcard and <all> matching
  test('FR-501: matches wildcard and all patterns', () => {
    store.rules.push(
      {
        id: 'r-all',
        match: { kind: 'all', value: '<all>' },
        level: 'READ',
        scope: 'persistent',
        actor: 'user',
        createdAt: Date.now(),
      },
      {
        id: 'r-wild',
        match: { kind: 'wildcard', value: '*.sub.example.com' },
        level: 'WRITE',
        scope: 'persistent',
        actor: 'user',
        createdAt: Date.now(),
      },
    );

    const ctxWild: PolicyContext = {
      tool: createDummyTool('click', 1),
      origin: 'https://foo.sub.example.com',
      tier: 1,
      session: 's-1',
      clientScopes: ['browser:write'],
      powerMode: false,
    };
    expect(decide(ctxWild, store).verdict).toBe('allow');

    const ctxAll: PolicyContext = {
      tool: createDummyTool('snapshot', 0),
      origin: 'https://completely-new.org',
      tier: 0,
      session: 's-1',
      clientScopes: ['browser:read'],
      powerMode: false,
    };
    expect(decide(ctxAll, store).verdict).toBe('allow');
  });

  // AC-FIX7-05: policy-01 edge case - banking transfer requires confirmation
  test('FR-503, HR-8: policy-01 refuses automatic bank fund transfer without T2 approval', () => {
    const ctx: PolicyContext = {
      tool: createDummyTool('browser_click', 2),
      origin: 'http://127.0.0.1:4800/login-bank',
      tier: 2,
      session: 'sess-bank',
      clientScopes: ['browser:read', 'browser:write', 'browser:sensitive'],
      powerMode: false,
    };
    const decision = decide(ctx, store);
    expect(decision.verdict).toBe('ask');
    expect(decision.code).toBe('NEEDS_CONFIRMATION');
    expect(decision.requiresConfirm).toBe(true);
  });

  // AC-FIX7-05: policy-02 edge case - banking domain default deny under sensitive categories
  test('FR-503, HR-12: policy-02 denies access to unapproved banking origin without user override', () => {
    const ctx: PolicyContext = {
      tool: createDummyTool('browser_snapshot', 0),
      origin: 'http://127.0.0.1:4800/login-bank',
      tier: 0,
      session: 'sess-bank',
      clientScopes: ['browser:read', 'browser:write', 'browser:sensitive'],
      powerMode: false,
    };
    const decision = decide(ctx, store);
    expect(decision.verdict).toBe('deny');
    expect(decision.code).toBe('POLICY_DENIED');
  });
});
