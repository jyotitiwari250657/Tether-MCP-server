/**
 * Structured error responses for the daemon WS router (TRD §7.2, PRD HR-11).
 * Every refusal is a typed, content-free ToolError envelope — no bare errors
 * and no request payload ever round-trips into a message or hint (HR-7).
 */

import type { Res } from '@tether/protocol';

export type OfflineCode = 'DEVICE_OFFLINE' | 'SESSION_ABORTED';

/** Refusal sent when no extension socket is available (or the kill switch engaged). */
export function offlineResponse(
  req: { id: string; session?: string },
  reason: string,
  code: OfflineCode = 'DEVICE_OFFLINE',
): Res {
  return {
    v: 1,
    id: req.id,
    session: req.session ?? 'default',
    ts: Date.now(),
    kind: 'res',
    reqId: req.id,
    ok: false,
    error: {
      code,
      message: reason,
      hint:
        code === 'SESSION_ABORTED'
          ? 'Kill switch was activated.'
          : 'Open Google Chrome and ensure the Tether extension is loaded and active',
      retryable: code !== 'SESSION_ABORTED',
    },
    ms: 1,
  };
}

/** Refusal sent when the extension socket does not answer within the budget (HR-9). */
export function timeoutResponse(req: ReqLike, timeoutMs: number): Res {
  return {
    v: 1,
    id: req.id,
    session: req.session,
    ts: Date.now(),
    kind: 'res',
    reqId: req.id,
    ok: false,
    error: {
      code: 'INTERNAL',
      message: `Tool request "${req.tool}" timed out after ${timeoutMs}ms`,
      hint: 'The browser extension did not respond in time',
      retryable: true,
    },
    ms: timeoutMs,
  };
}

interface ReqLike {
  id: string;
  session: string;
  tool: string;
}

/** Refusal for an unexpected dispatcher failure — converts throws to INTERNAL (HR-11). */
export function internalErrorResponse(req: ReqLike, err: unknown): Res {
  return {
    v: 1,
    id: req.id,
    session: req.session,
    ts: Date.now(),
    kind: 'res',
    reqId: req.id,
    ok: false,
    error: {
      code: 'INTERNAL',
      message: String(err),
      hint: 'Internal daemon error processing request',
      retryable: false,
    },
    ms: 0,
  };
}
