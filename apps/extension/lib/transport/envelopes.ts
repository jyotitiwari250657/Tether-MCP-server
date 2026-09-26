/**
 * Transport Envelope Builders (TRD §6.11).
 */

import type { EnvelopeType, HelloPayload, Req, ResErr, ToolError } from '@tether/protocol';

export function makeHelloEnvelope(token: string | null): EnvelopeType {
  const helloPayload: HelloPayload = {
    protocolVersion: 1,
    extensionVersion: '0.1.0',
    ...(token ? { token } : {}),
  };
  return {
    v: 1,
    id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `h-${Date.now()}`,
    session: 'handshake',
    ts: Date.now(),
    kind: 'evt',
    evt: 'hello',
    payload: helloPayload,
  };
}

export function makeKillEnvelope(reason: string): EnvelopeType {
  return {
    v: 1,
    id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `kill-${Date.now()}`,
    session: 'kill',
    ts: Date.now(),
    kind: 'evt',
    evt: 'kill',
    payload: { reason },
  };
}

export function makeInboundResErr(req: Req, error: ToolError, start: number): ResErr {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    v: 1,
    id: req.id,
    session: req.session ?? 'default',
    ts: Date.now(),
    kind: 'res',
    reqId: req.id,
    ok: false,
    error,
    ms: Math.max(1, Math.round(now - start)),
  };
}
