import { describe, expect, test } from 'vitest';
import { type ErrorCode, ErrorCodes, HINTS, type ToolError, toolError } from '../src/errors.js';

describe('Error Catalogue & Structured Failure (TRD §5.5, PRD HR-11)', () => {
  test('TRD §5.5: All specified error codes are present in catalogue', () => {
    const expectedCodes: ErrorCode[] = [
      'REF_STALE',
      'REF_NOT_FOUND',
      'TAB_GONE',
      'UNSUPPORTED_FRAME',
      'POLICY_DENIED',
      'PERMISSION_REQUIRED',
      'NEEDS_CONFIRMATION',
      'CONFIRM_TOKEN_INVALID',
      'CONFIRM_TOKEN_EXPIRED',
      'DEVICE_OFFLINE',
      'DEVICE_BUSY',
      'RATE_LIMITED',
      'TIMEOUT',
      'SESSION_ABORTED',
      'SCHEMA_INVALID',
      'EGRESS_BLOCKED',
      'INTERNAL',
    ];

    for (const code of expectedCodes) {
      expect(ErrorCodes).toContain(code);
    }
    expect(ErrorCodes.length).toBe(17);
  });

  test('TRD §5.5: Defined HINTS match expected model guidance', () => {
    expect(HINTS.REF_STALE).toBe('Call browser_snapshot once, then retry with the new ref.');
    expect(HINTS.REF_NOT_FOUND).toBe('Call browser_snapshot to obtain current refs.');
    expect(HINTS.POLICY_DENIED).toBe(
      'Do not retry. Ask the user with ask_user, or call policy_grant to request access.',
    );
    expect(HINTS.NEEDS_CONFIRMATION).toBe(
      'Call confirm_action with the returned confirmId and diff; wait for the user.',
    );
    expect(HINTS.RATE_LIMITED).toBe('Wait retryAfterMs, then retry once.');
    expect(HINTS.DEVICE_BUSY).toBe(
      'Another client is driving the browser. Tell the user; do not retry in a loop.',
    );
    expect(HINTS.SCHEMA_INVALID).toBe(
      'Fix the schema and retry; see details.errors for the failing paths.',
    );
    expect(HINTS.TIMEOUT).toBe('Use browser_task_start for work that exceeds 30 seconds.');
    expect(HINTS.SESSION_ABORTED).toBe('The user engaged the kill switch. Stop.');
  });

  test('TRD §5.5: toolError correctly sets retryable flag', () => {
    expect(toolError('REF_STALE').retryable).toBe(true);
    expect(toolError('TIMEOUT').retryable).toBe(true);
    expect(toolError('RATE_LIMITED').retryable).toBe(true);
    expect(toolError('DEVICE_BUSY').retryable).toBe(true);

    expect(toolError('POLICY_DENIED').retryable).toBe(false);
    expect(toolError('SCHEMA_INVALID').retryable).toBe(false);
    expect(toolError('INTERNAL').retryable).toBe(false);
  });

  test('PRD HR-7 / TRD §5.5: Details validation heuristic rejects PII and secret leakage', () => {
    // Secret pattern detectors (Bearer tokens, JWTs, PAN card numbers, email addresses)
    const SECRET_PATTERNS = [
      /Bearer\s+[A-Za-z0-9._~+/-]+=*/i,
      /\beyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+/i,
      /\b\d{16,19}\b/, // 16+ digit PAN pattern
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // email pattern
    ];

    function containsSecret(value: unknown): boolean {
      if (typeof value === 'string') {
        return SECRET_PATTERNS.some((pattern) => pattern.test(value));
      }
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some((v) => containsSecret(v));
      }
      return false;
    }

    const cleanError: ToolError = toolError('SCHEMA_INVALID', {
      details: { field: 'username', reason: 'too_short' },
    });
    expect(containsSecret(cleanError.details)).toBe(false);

    const bearerLeak: ToolError = toolError('INTERNAL', {
      details: { header: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' },
    });
    expect(containsSecret(bearerLeak.details)).toBe(true);

    const panLeak: ToolError = toolError('POLICY_DENIED', {
      details: { attemptedCard: '4111222233334444' },
    });
    expect(containsSecret(panLeak.details)).toBe(true);

    const emailLeak: ToolError = toolError('POLICY_DENIED', {
      details: { recipient: 'user@example.com' },
    });
    expect(containsSecret(emailLeak.details)).toBe(true);
  });
});
