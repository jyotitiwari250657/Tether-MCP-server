/**
 * Governance & Meta-Tool Specifications (PRD §10.2, TRD §5.4, TOOL-G01..G07).
 * Present in both 'browser-readonly' and 'browser-act' profiles.
 */

import { z } from 'zod';
import type { ToolSpec } from './index.js';

// TOOL-G01: policy_get
export const policy_get: ToolSpec = {
  name: 'policy_get',
  title: 'Get policy',
  description: 'Get policy rules for domain.',
  tier: 3,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    domain: z.string().optional(),
  }),
  output: z.object({
    rules: z.array(z.object({ domain: z.string(), level: z.string() })),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'READ' },
  budgetMs: 1000,
};

// TOOL-G02: policy_grant
export const policy_grant: ToolSpec = {
  name: 'policy_grant',
  title: 'Grant policy',
  description: 'Request capability grant for domain.',
  tier: 3,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
  },
  input: z.object({
    domain: z.string(),
    level: z.string(),
    ttl: z.number(),
  }),
  output: z.object({
    granted: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'SENSITIVE' },
  budgetMs: 30000,
};

// TOOL-G03: policy_revoke
export const policy_revoke: ToolSpec = {
  name: 'policy_revoke',
  title: 'Revoke policy',
  description: 'Revoke capability grant.',
  tier: 3,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    domain: z.string().optional(),
    clientId: z.string().optional(),
  }),
  output: z.object({
    revoked: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'SENSITIVE' },
  budgetMs: 5000,
};

// TOOL-G04: ask_user
export const ask_user: ToolSpec = {
  name: 'ask_user',
  title: 'Ask user',
  description: 'Ask user a question.',
  tier: 3,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
  },
  input: z.object({
    question: z.string(),
    options: z.array(z.string()).optional(),
  }),
  output: z.object({
    answer: z.string(),
    trust: z.literal('untrusted'),
  }),
  requires: { grant: 'READ' },
  budgetMs: 30000,
};

// TOOL-G05: confirm_action
export const confirm_action: ToolSpec = {
  name: 'confirm_action',
  title: 'Confirm action',
  description: 'Request user confirmation with diff.',
  tier: 3,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
  },
  input: z.object({
    title: z.string(),
    diff: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
      }),
    ),
    token: z.string(),
  }),
  output: z.object({
    confirmed: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'READ' },
  budgetMs: 30000,
};

// TOOL-G06: session_pause
export const session_pause: ToolSpec = {
  name: 'session_pause',
  title: 'Pause session',
  description: 'Pause automation session.',
  tier: 3,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    reason: z.string().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'SENSITIVE' },
  budgetMs: 1000,
};

// TOOL-G06: session_resume
export const session_resume: ToolSpec = {
  name: 'session_resume',
  title: 'Resume session',
  description: 'Resume automation session.',
  tier: 3,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    reason: z.string().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'SENSITIVE' },
  budgetMs: 1000,
};

// TOOL-G06: session_abort
export const session_abort: ToolSpec = {
  name: 'session_abort',
  title: 'Abort session',
  description: 'Abort automation session.',
  tier: 3,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    reason: z.string().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'SENSITIVE' },
  budgetMs: 1000,
};

// TOOL-G06: session_status
export const session_status: ToolSpec = {
  name: 'session_status',
  title: 'Session status',
  description: 'Get session status.',
  tier: 3,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({}),
  output: z.object({
    status: z.string(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'READ' },
  budgetMs: 1000,
};

// TOOL-G07: audit_export
export const audit_export: ToolSpec = {
  name: 'audit_export',
  title: 'Export audit',
  description: 'Export audit log entries.',
  tier: 3,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    range: z.string().optional(),
    format: z.string().optional(),
  }),
  output: z.object({
    data: z.string(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'READ' },
  budgetMs: 10000,
};

export const GOVERNANCE_TOOLS: readonly ToolSpec<unknown, unknown>[] = [
  policy_get,
  policy_grant,
  policy_revoke,
  ask_user,
  confirm_action,
  session_pause,
  session_resume,
  session_abort,
  session_status,
  audit_export,
] as const;
