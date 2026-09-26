import { describe, expect, test } from 'vitest';
import {
  Envelope,
  EventNames,
  type Evt,
  MAX_ENVELOPE_BYTES,
  type Req,
  type ResErr,
  type ResOk,
} from '../src/envelope.js';
import { toolError } from '../src/errors.js';

describe('Envelope & Wire Protocol (TRD §5.2, Appendix A)', () => {
  test('TRD §5.2 / PRD FR-313: MAX_ENVELOPE_BYTES is capped at 900 KB', () => {
    expect(MAX_ENVELOPE_BYTES).toBe(900 * 1024);
    expect(MAX_ENVELOPE_BYTES).toBe(921600);
  });

  test('TRD §5.2 / PRD FR-401: Validates req envelope round-trip with Zod', () => {
    const validReq: Req = {
      v: 1,
      id: '01J8ZK3M9QW7RT2VYB4C6D8E0F',
      session: 'ses_123',
      ts: Date.now(),
      kind: 'req',
      tool: 'browser_snapshot',
      args: { format: 'a11y' },
      token: 'jwt_token_example',
      idem: 'idem_abc123',
      budgetMs: 15_000,
    };

    const parsed = Envelope.safeParse(validReq);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.kind).toBe('req');
      expect(parsed.data.budgetMs).toBe(15_000);
    }
  });

  test('TRD §5.2 / PRD HR-9: Rejects req envelope exceeding 30s budget ceiling', () => {
    const invalidReq = {
      v: 1,
      id: '01J8ZK3M9QW7RT2VYB4C6D8E0F',
      session: 'ses_123',
      ts: Date.now(),
      kind: 'req',
      tool: 'browser_snapshot',
      args: {},
      token: 'jwt_token_example',
      idem: 'idem_abc123',
      budgetMs: 30_001, // exceeds HR-9 30,000 ms ceiling
    };

    const parsed = Envelope.safeParse(invalidReq);
    expect(parsed.success).toBe(false);
  });

  test('TRD §5.2 / PRD FR-401: Validates res (ok) envelope round-trip', () => {
    const validResOk: ResOk = {
      v: 1,
      id: '01J8ZK3M9QW7RT2VYB4C6D8E01',
      session: 'ses_123',
      ts: Date.now(),
      kind: 'res',
      reqId: '01J8ZK3M9QW7RT2VYB4C6D8E0F',
      ok: true,
      result: { tree: 'body\n  button[ref=A1]' },
      ms: 120,
    };

    const parsed = Envelope.safeParse(validResOk);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.kind).toBe('res');
      if (parsed.data.kind === 'res' && parsed.data.ok) {
        expect(parsed.data.result).toEqual({ tree: 'body\n  button[ref=A1]' });
      }
    }
  });

  test('TRD §5.2 / PRD HR-11: Validates res (error) envelope round-trip', () => {
    const validResErr: ResErr = {
      v: 1,
      id: '01J8ZK3M9QW7RT2VYB4C6D8E02',
      session: 'ses_123',
      ts: Date.now(),
      kind: 'res',
      reqId: '01J8ZK3M9QW7RT2VYB4C6D8E0F',
      ok: false,
      error: toolError('REF_STALE'),
      ms: 45,
    };

    const parsed = Envelope.safeParse(validResErr);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.kind).toBe('res');
      if (parsed.data.kind === 'res' && !parsed.data.ok) {
        expect(parsed.data.error.code).toBe('REF_STALE');
      }
    }
  });

  test('TRD §5.2 / PRD FR-512: Validates standard evt envelope', () => {
    const validEvt: Evt = {
      v: 1,
      id: '01J8ZK3M9QW7RT2VYB4C6D8E03',
      session: 'ses_123',
      ts: Date.now(),
      kind: 'evt',
      evt: 'step',
      payload: { seq: 1, tool: 'browser_snapshot' },
    };

    const parsed = Envelope.safeParse(validEvt);
    expect(parsed.success).toBe(true);
    expect(EventNames).toContain('step');
  });

  test('TRD §5.2: Unknown evt names validate successfully for forward compatibility', () => {
    const futureEvt: Evt = {
      v: 1,
      id: '01J8ZK3M9QW7RT2VYB4C6D8E04',
      session: 'ses_123',
      ts: Date.now(),
      kind: 'evt',
      evt: 'future.unrecognized.event',
      payload: { arbitrary: 'data' },
    };

    const parsed = Envelope.safeParse(futureEvt);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.kind === 'evt') {
      expect(parsed.data.evt).toBe('future.unrecognized.event');
    }
  });
});
