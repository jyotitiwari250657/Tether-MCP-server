/**
 * Error Codes & Structured Errors (TRD §5.5, PRD HR-11).
 * Fail structured, never bare. Every error code includes an actionable hint for the AI model.
 */

import type { Tier } from './envelope.js';

export const ErrorCodes = [
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
] as const;

export type ErrorCode = (typeof ErrorCodes)[number];

export interface ToolError {
  code: ErrorCode;
  message: string;
  hint?: string | undefined;
  retryable: boolean;
  tier?: Tier | undefined;
  // details MUST NOT contain page content or secrets (PRD HR-7)
  details?: Record<string, unknown> | undefined;
}

// Machine-readable hints provided specifically to guide client model behavior
export const HINTS: Partial<Record<ErrorCode, string>> = {
  REF_STALE: 'Call browser_snapshot once, then retry with the new ref.',
  REF_NOT_FOUND: 'Call browser_snapshot to obtain current refs.',
  POLICY_DENIED:
    'Do not retry. Ask the user with ask_user, or call policy_grant to request access.',
  NEEDS_CONFIRMATION:
    'Call confirm_action with the returned confirmId and diff; wait for the user.',
  RATE_LIMITED: 'Wait retryAfterMs, then retry once.',
  DEVICE_BUSY: 'Another client is driving the browser. Tell the user; do not retry in a loop.',
  SCHEMA_INVALID: 'Fix the schema and retry; see details.errors for the failing paths.',
  TIMEOUT: 'Use browser_task_start for work that exceeds 30 seconds.',
  SESSION_ABORTED: 'The user engaged the kill switch. Stop.',
};

const RETRYABLE_CODES = new Set<ErrorCode>(['REF_STALE', 'TIMEOUT', 'RATE_LIMITED', 'DEVICE_BUSY']);

/**
 * Creates a typed ToolError with standardized retryability and model-oriented guidance.
 */
export function toolError(code: ErrorCode, extra?: Partial<ToolError>): ToolError {
  return {
    code,
    message: extra?.message ?? code,
    retryable: extra?.retryable ?? RETRYABLE_CODES.has(code),
    ...(HINTS[code] ? { hint: HINTS[code] } : {}),
    ...extra,
  };
}
