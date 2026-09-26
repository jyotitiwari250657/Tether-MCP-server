/**
 * Wire Protocol Envelope & Types (TRD §5.2, Appendix A).
 * Defines the standard message container for communication across extension, daemon, and relay.
 */

import { z } from 'zod';
import type { ToolError } from './errors.js';
import { PROTOCOL_VERSION, isCompatible } from './version.js';

export { PROTOCOL_VERSION, isCompatible };

export type Scope = 'browser:read' | 'browser:write' | 'browser:sensitive' | 'offline_access';
export type ToolProfile = 'browser-readonly' | 'browser-act';
export type Tier = 0 | 1 | 2 | 3;
export type TransportMode = 'local' | 'hosted' | 'inpage';
export type Trust = 'untrusted' | 'tether';
export type GrantLevel = 'DENY' | 'READ' | 'ASK' | 'WRITE' | 'SENSITIVE';

// TRD §5.3 Event catalogue
export const EventNames = [
  'device.state',
  'session.started',
  'session.ended',
  'step',
  'progress',
  'approval.request',
  'approval.response',
  'egress.blocked',
  'audit.append',
  'client.attached',
  'client.detached',
  'kill',
  'policy.changed',
] as const;

export type EventName = (typeof EventNames)[number];

export interface ReqMeta {
  chunk?: number;
  chunks?: number;
  sha256?: string;
  progressToken?: string;
}

export interface BaseEnvelope {
  v: 1;
  id: string;
  session: string;
  ts: number;
}

export interface Req extends BaseEnvelope {
  kind: 'req';
  tool: string;
  args: unknown;
  token: string;
  idem: string;
  budgetMs: number;
  meta?: ReqMeta | undefined;
}

export interface ResOk extends BaseEnvelope {
  kind: 'res';
  reqId: string;
  ok: true;
  result: unknown;
  ms: number;
  meta?: ReqMeta | undefined;
}

export interface ResErr extends BaseEnvelope {
  kind: 'res';
  reqId: string;
  ok: false;
  error: ToolError;
  ms: number;
}

export type Res = ResOk | ResErr;

export interface Evt extends BaseEnvelope {
  kind: 'evt';
  evt: EventName | string;
  payload: unknown;
}

export interface HelloPayload {
  protocolVersion?: number | undefined;
  extensionVersion?: string | undefined;
  token?: string | null | undefined;
}

export interface HelloAckPayload {
  ok: boolean;
  token?: string | undefined;
  protocolVersion?: number | undefined;
  daemonVersion?: string | undefined;
}

export type EnvelopeType = Req | Res | Evt;

// Maximum message envelope size: 900 KB (native messaging host -> Chrome limit is 1 MB, PRD FR-313, TRD §5.2)
export const MAX_ENVELOPE_BYTES = 900 * 1024;

// Zod schemas for runtime validation
export const ReqSchema = z.object({
  v: z.literal(1),
  id: z.string(),
  session: z.string(),
  ts: z.number(),
  kind: z.literal('req'),
  tool: z.string(),
  args: z.unknown(),
  token: z.string(),
  idem: z.string(),
  budgetMs: z.number().int().min(1).max(30_000), // HR-9: budget <= 30s
  meta: z.custom<ReqMeta>().optional(),
});

export const ResOkSchema = z.object({
  v: z.literal(1),
  id: z.string(),
  session: z.string(),
  ts: z.number(),
  kind: z.literal('res'),
  reqId: z.string(),
  ok: z.literal(true),
  result: z.unknown(),
  ms: z.number(),
  meta: z.custom<ReqMeta>().optional(),
});

export const ResErrSchema = z.object({
  v: z.literal(1),
  id: z.string(),
  session: z.string(),
  ts: z.number(),
  kind: z.literal('res'),
  reqId: z.string(),
  ok: z.literal(false),
  error: z.custom<ToolError>(),
  ms: z.number(),
});

// TRD §5.2: Unknown evt names MUST be ignored, not errored (forward compatibility)
export const EvtSchema = z.object({
  v: z.literal(1),
  id: z.string(),
  session: z.string(),
  ts: z.number(),
  kind: z.literal('evt'),
  evt: z.string(),
  payload: z.unknown(),
});

export const Envelope = z.union([ReqSchema, ResOkSchema, ResErrSchema, EvtSchema]);

export type EnvelopeT = z.infer<typeof Envelope>;
