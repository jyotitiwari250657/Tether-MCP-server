// @vitest-environment node
/**
 * Policy Decision Engine — normative decision steps 1–4 (TRD §6.6.2, PRD FR-501..FR-505,
 * HR-8, HR-10). Verifies short-circuit order for kill switch, Tier-2 confirmation,
 * client scopes and power mode. Split from engine.spec.ts for the TRD §4.3 300-line cap.
 */

import type { PolicyRule } from '@tether/protocol';
import { beforeEach, describe, expect, test } from 'vitest';
import { decide } from '../../lib/policy/engine.js';
import type { PolicyContext, PolicyStore } from '../../lib/policy/types.js';
import { createDummyTool } from './helpers.js';

describe('Policy Decision Engine — steps 1-4 (TRD §6.6.2, PRD FR-501..FR-505)', () => {
  let store: PolicyStore;

  beforeEach(() => {
    store = {
      rules: [] as PolicyRule[],
      version: '1.0.0',
    };
  });

  // Step 1: Kill switch engaged
  test('HR-10, FR-501: step 1 denies with SESSION_ABORTED when kill switch engaged', () => {
    const ctx: PolicyContext = {
      tool: createDummyTool('browser_snapshot', 0),
      origin: 'https://example.com',
      tier: 0,
      session: 's-1',
      clientScopes: ['browser:read'],
      powerMode: false,
    };
    const decision = decide(ctx, store, { killSwitchEngaged: true });
    expect(decision.verdict).toBe('deny');
    expect(decision.code).toBe('SESSION_ABORTED');
  });

  // Step 2: Tier 2 without confirmToken -> ask
  test('HR-8, FR-507: step 2 asks for confirmation on Tier 2 without confirmToken', () => {
    const ctx: PolicyContext = {
      tool: createDummyTool('browser_submit', 2),
      origin: 'https://example.com',
      tier: 2,
      session: 's-1',
      clientScopes: ['browser:write'],
      powerMode: false,
    };
    // Even if an explicit WRITE rule exists, Tier 2 MUST ask if confirmToken is missing
    store.rules.push({
      id: 'r-1',
      match: { kind: 'exact', value: 'example.com' },
      level: 'WRITE',
      scope: 'persistent',
      actor: 'user',
      createdAt: Date.now(),
    });

    const decision = decide(ctx, store);
    expect(decision.verdict).toBe('ask');
    expect(decision.code).toBe('NEEDS_CONFIRMATION');
    expect(decision.requiresConfirm).toBe(true);
    expect(decision.diff).toBeDefined();
  });

  // Step 3: Missing client scopes
  test('FR-502: step 3 denies with PERMISSION_REQUIRED when client lacks scope', () => {
    const ctx: PolicyContext = {
      tool: createDummyTool('browser_click', 1),
      origin: 'https://example.com',
      tier: 1,
      session: 's-1',
      clientScopes: ['browser:read'], // missing browser:write
      powerMode: false,
    };
    const decision = decide(ctx, store);
    expect(decision.verdict).toBe('deny');
    expect(decision.code).toBe('PERMISSION_REQUIRED');
  });

  test('FR-502: step 3 checks secret scope requirement', () => {
    const ctx: PolicyContext = {
      tool: createDummyTool('browser_type_secret', 2, false, true),
      origin: 'https://example.com',
      tier: 2,
      session: 's-1',
      clientScopes: ['browser:write'], // missing browser:sensitive
      powerMode: false,
    };
    const decision = decide(ctx, store, { confirmToken: 'tok-123' });
    expect(decision.verdict).toBe('deny');
    expect(decision.code).toBe('PERMISSION_REQUIRED');
  });

  // Step 4: Power mode required but disabled
  test('FR-502: step 4 denies with PERMISSION_REQUIRED when powerMode required but off', () => {
    const ctx: PolicyContext = {
      tool: createDummyTool('browser_screenshot', 0, true),
      origin: 'https://example.com',
      tier: 0,
      session: 's-1',
      clientScopes: ['browser:read'],
      powerMode: false,
    };
    const decision = decide(ctx, store);
    expect(decision.verdict).toBe('deny');
    expect(decision.code).toBe('PERMISSION_REQUIRED');
  });
});
