/**
 * Daemon Loopback Bootstrap & Security Verification (SEC-07, TRD §7.2).
 * Verifies loopback peer address, origin binding, and records daemon audit entries.
 */

import type { Evt, HelloAckPayload, HelloPayload } from '@tether/protocol';
import type { WebSocket } from 'ws';
import { generateToken, verifyToken } from './auth.js';

export interface DaemonAuditEntry {
  tool: string;
  verdict: 'allow' | 'deny';
  detail?: string;
  ts: number;
}

const auditLog: DaemonAuditEntry[] = [];

/**
 * Appends an entry to the daemon audit log.
 * Ensures zero secret or token leakage (HR-7).
 */
export function recordDaemonAudit(entry: Omit<DaemonAuditEntry, 'ts'>): DaemonAuditEntry {
  const record: DaemonAuditEntry = {
    ...entry,
    ts: Date.now(),
  };
  auditLog.push(record);
  return record;
}

/**
 * Returns all recorded daemon audit entries.
 */
export function getDaemonAuditLog(): readonly DaemonAuditEntry[] {
  return auditLog;
}

/**
 * Clears the in-memory daemon audit log (primarily for testing).
 */
export function clearDaemonAuditLog(): void {
  auditLog.length = 0;
}

/**
 * Checks whether an incoming socket peer address is on loopback (127.0.0.1 or ::1).
 */
export function isLoopbackAddress(addr?: string | null): boolean {
  if (!addr) return false;
  const clean = addr.replace(/^::ffff:/, '').trim();
  return clean === '127.0.0.1' || clean === '::1';
}

/**
 * Checks whether the Origin header matches the pinned extension ID or a valid extension origin.
 */
export function isPinnedOrigin(origin?: string, pinnedExtensionId?: string): boolean {
  if (!origin) return false;
  const lower = origin.toLowerCase().trim();

  if (pinnedExtensionId && pinnedExtensionId.trim().length > 0) {
    return lower === `chrome-extension://${pinnedExtensionId.toLowerCase().trim()}`;
  }

  // if pinnedExtensionId is undefined, accept any origin matching /^chrome-extension:\/\/[a-p]{32}$/
  return /^chrome-extension:\/\/[a-p]{32}$/.test(lower);
}

export interface BootstrapCheckParams {
  origin?: string | undefined;
  peerAddress?: string | null | undefined;
  pinnedExtensionId?: string | undefined;
}

/**
 * Evaluates whether a token-less hello request is eligible for bootstrap token issuance.
 */
export function evaluateBootstrapEligibility(params: BootstrapCheckParams): {
  eligible: boolean;
  reason?: string;
} {
  if (!isLoopbackAddress(params.peerAddress)) {
    return {
      eligible: false,
      reason: 'non-loopback',
    };
  }

  if (!isPinnedOrigin(params.origin, params.pinnedExtensionId)) {
    return {
      eligible: false,
      reason: 'origin-mismatch',
    };
  }

  return { eligible: true };
}

export interface HelloHandshakeContext {
  expectedToken: string;
  pinnedExtensionId?: string | undefined;
  origin: string;
  peerAddress: string | null;
  onAuthenticated: () => void;
  rotateToken?: ((newToken: string) => void) | undefined;
}

/**
 * Handles hello envelope and executes bootstrap, token validation, or rotation reissue.
 * Ensures zero secret or token value leakage in logs (HR-7).
 */
export function handleHelloHandshake(env: Evt, ws: WebSocket, ctx: HelloHandshakeContext): boolean {
  const hello = (env.payload as HelloPayload | undefined) ?? {};
  const presented: string | null = hello.token ?? null;
  const originOk = isPinnedOrigin(ctx.origin, ctx.pinnedExtensionId);
  const loopbackOk = isLoopbackAddress(ctx.peerAddress);
  const eligible = originOk && loopbackOk;

  // 1. presented !== null && timingSafeEqual(presented, expectedToken) -> ack {ok:true} (no reissue)
  if (presented !== null && verifyToken(presented, ctx.expectedToken)) {
    ctx.onAuthenticated();
    console.log('[Tether] extension connected via token');

    const ack: Evt = {
      v: 1,
      id: `ack-${Date.now()}`,
      session: env.session,
      ts: Date.now(),
      kind: 'evt',
      evt: 'hello-ack',
      payload: { ok: true },
    };
    ws.send(JSON.stringify(ack));
    return true;
  }

  // 2. eligible && (presented === null || presented !== expectedToken) -> bootstrap/reissue
  if (eligible && (presented === null || !verifyToken(presented, ctx.expectedToken))) {
    const isBootstrap = presented === null;
    let tokenToIssue = ctx.expectedToken;
    let detail = 'loopback token issued';

    if (!isBootstrap) {
      tokenToIssue = generateToken();
      ctx.rotateToken?.(tokenToIssue);
      detail = 'stale token rotated';
    }

    ctx.onAuthenticated();
    recordDaemonAudit({
      tool: 'daemon.bootstrap',
      verdict: 'allow',
      detail,
    });
    console.log('[Tether] extension connected via bootstrap');

    const ackPayload: HelloAckPayload = {
      ok: true,
      token: tokenToIssue,
      protocolVersion: 1,
      daemonVersion: '0.1.0',
    };

    const ack: Evt = {
      v: 1,
      id: `ack-${Date.now()}`,
      session: env.session,
      ts: Date.now(),
      kind: 'evt',
      evt: 'hello-ack',
      payload: ackPayload,
    };
    ws.send(JSON.stringify(ack));
    return true;
  }

  // 3. Else reject (close 4001) with audit and log EXACTLY
  let reason: 'origin-mismatch' | 'non-loopback' | 'invalid-token-non-eligible';
  if (!originOk) {
    reason = 'origin-mismatch';
  } else if (!loopbackOk && presented === null) {
    reason = 'non-loopback';
  } else {
    reason = 'invalid-token-non-eligible';
  }

  const originText = ctx.origin && ctx.origin.length > 0 ? ctx.origin : 'none';
  const peerText = ctx.peerAddress && ctx.peerAddress.length > 0 ? ctx.peerAddress : 'none';
  const tokenPresent = presented !== null;

  recordDaemonAudit({
    tool: 'daemon.handshake',
    verdict: 'deny',
    detail: reason,
  });
  console.warn(
    `[Tether] handshake rejected: ${reason} origin=${originText} peer=${peerText} tokenPresent=${tokenPresent}`,
  );
  ws.close(4001, 'Unauthorized');
  return false;
}
