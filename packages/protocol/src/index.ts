/**
 * @tether/protocol — The Frozen Contract (PRD HR-4, TRD §4.3.3, TRD §5).
 * Single canonical source of wire types, error codes, and tool definitions across Tether.
 *
 * NOTE (TRD §4.3.3): This is the root permitted barrel file.
 */

// Versioning and protocol compatibility (TRD §5.1)
export { PROTOCOL_VERSION, isCompatible } from './version.js';

// Wire protocol envelope, discriminators and event types (TRD §5.2)
export {
  EventNames,
  MAX_ENVELOPE_BYTES,
  Envelope,
  ReqSchema,
  ResOkSchema,
  ResErrSchema,
  EvtSchema,
  type Scope,
  type ToolProfile,
  type Tier,
  type TransportMode,
  type Trust,
  type GrantLevel,
  type EventName,
  type ReqMeta,
  type BaseEnvelope,
  type Req,
  type ResOk,
  type ResErr,
  type Res,
  type Evt,
  type HelloPayload,
  type HelloAckPayload,
  type EnvelopeType,
  type EnvelopeT,
} from './envelope.js';

// Error catalogue, codes and helpers (TRD §5.5, PRD HR-11)
export {
  ErrorCodes,
  HINTS,
  toolError,
  type ErrorCode,
  type ToolError,
} from './errors.js';

// DOM accessibility snapshot and ref structures (TRD §5.4, §6.4)
export type {
  Rect,
  RefEntry,
  SnapshotResult,
} from './snapshot.js';

// Governance, capability grants, and confirmation diffs (TRD §5.3, §6.6, PRD HR-8)
export type {
  DomainPattern,
  SensitiveCategory,
  PolicyRule,
  DiffRow,
  Decision,
} from './policy.js';

// Tamper-evident audit chain and canonical JSON (TRD §5.3, §6.9, PRD FR-512)
export {
  canonicalJson,
  hashEntry,
  verifyChain,
  type AuditEntry,
} from './audit.js';

// Device pairing & OAuth 2.1 metadata DTOs (PRD FR-602..606, TRD §8)
export type {
  PairBeginRequest,
  PairBeginResponse,
  PairConfirmRequest,
  OAuthClientRegistration,
  TokenResponse,
  OAuthResourceMetadata,
  OAuthAuthorizationServerMetadata,
} from './pairing.js';

// Tool registry, profiles, and anti-spoofing namespaces (TRD §5.4)
export {
  TOOLS,
  PROFILES,
  FORBIDDEN_TOOLS,
  TOOL_NAME_RE,
  isToolAllowed,
  listToolsForProfile,
  calculateToolsTokenBudget,
  tokenBudgetForProfile,
  type ToolAnnotations,
  type ToolRequires,
  type ToolSpec,
  type ForbiddenTool,
} from './tools/index.js';

// Scaffold tool lists (TRD §5.4)
export { READONLY_TOOLS } from './tools/readonly.js';
export { ACT_TOOLS } from './tools/act.js';
export { GOVERNANCE_TOOLS } from './tools/governance.js';
export { WEBMCP_TOOLS } from './tools/webmcp.js';
