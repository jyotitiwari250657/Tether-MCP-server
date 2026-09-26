/**
 * Tool Surface Registry, Profiles & Specifications (TRD §5.4, §10, Appendix A).
 * Frozen tool definitions and strict anti-spoofing constraints.
 */

import type { ZodType } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { GrantLevel, Tier, ToolProfile } from '../envelope.js';
import { ACT_TOOLS } from './act.js';
import { GOVERNANCE_TOOLS } from './governance.js';
import { READONLY_TOOLS } from './readonly.js';
import { WEBMCP_TOOLS } from './webmcp.js';

export interface ToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  openWorldHint: boolean;
  idempotentHint: boolean;
}

export interface ToolRequires {
  grant?: GrantLevel | undefined; // Minimum domain capability grant
  confirm?: boolean | undefined; // T2 => true (PRD HR-8)
  secret?: boolean | undefined; // Vault-touching action
  powerMode?: boolean | undefined; // Requires CDP Power Mode (v1.1)
}

export interface ToolSpec<I = unknown, O = unknown> {
  name: string; // Must match TOOL_NAME_RE
  title: string; // Human-readable, <40 chars
  description: string; // Model-oriented, <200 chars
  tier: Tier;
  profiles: readonly ToolProfile[];
  annotations: ToolAnnotations;
  input: ZodType<I>;
  output: ZodType<O>;
  requires: ToolRequires;
  budgetMs: number; // <= 30_000 (PRD HR-9)
  resumable?: boolean | undefined;
}

// Canonical tool registry: all 40 tools populated in P03 (PRD HR-4)
export const TOOLS: readonly ToolSpec<unknown, unknown>[] = [
  ...READONLY_TOOLS,
  ...ACT_TOOLS,
  ...GOVERNANCE_TOOLS,
  ...WEBMCP_TOOLS,
] as const;

// Profile derivation: browser-readonly and browser-act (PRD FR-611)
export const PROFILES: Record<ToolProfile, readonly string[]> = {
  'browser-readonly': TOOLS.filter((t) => t.profiles.includes('browser-readonly')).map(
    (t) => t.name,
  ),
  'browser-act': TOOLS.filter((t) => t.profiles.includes('browser-act')).map((t) => t.name),
};

// TRD §5.4 / PRD SEC-03 / FR-505 / NG-3: Forbidden tools assertion
export const FORBIDDEN_TOOLS = [
  'evaluate_script',
  'network_request',
  'cookies_get',
  'cookies_set',
  'history_read',
  'bookmarks_read',
] as const;

export type ForbiddenTool = (typeof FORBIDDEN_TOOLS)[number];

// Anti-spoofing namespace constraint regex (TRD §5.4, PRD SEC-10)
export const TOOL_NAME_RE =
  /^(browser|site|policy|audit|session|ask|confirm)_[a-z_]+$|^(search|fetch)(_[a-z_]+)?$/;

/**
 * Checks whether a given tool name is allowed within a profile.
 */
export function isToolAllowed(toolName: string, profile: ToolProfile): boolean {
  return PROFILES[profile].includes(toolName);
}

/**
 * Returns all tool specifications exposed by a profile.
 */
export function listToolsForProfile(profile: ToolProfile): readonly ToolSpec<unknown, unknown>[] {
  return TOOLS.filter((t) => t.profiles.includes(profile));
}

function stripAdditionalProperties(o: unknown): unknown {
  if (!o || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map(stripAdditionalProperties);
  const res: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (k === 'additionalProperties') continue;
    res[k] = stripAdditionalProperties(v);
  }
  return res;
}

/**
 * Calculates token budget for a list of tool specifications using the 4-char heuristic (TRD §11, NFR-110).
 */
export function calculateToolsTokenBudget(tools: readonly ToolSpec<unknown, unknown>[]): number {
  if (tools.length === 0) {
    return 0;
  }

  let totalTokens = 0;
  for (const tool of tools) {
    const inputSchema = stripAdditionalProperties(
      zodToJsonSchema(tool.input, { target: 'openApi3' }),
    );
    const outputSchema = stripAdditionalProperties(
      zodToJsonSchema(tool.output, { target: 'openApi3' }),
    );

    const annotations: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(tool.annotations)) {
      if (v) annotations[k] = true;
    }

    const mcpToolObject = {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema,
      outputSchema,
      annotations,
    };
    totalTokens += Math.ceil(JSON.stringify(mcpToolObject).length / 4);
  }

  return totalTokens;
}

/**
 * Token budget calculation heuristic (TRD §11, NFR-110, PRD FR-612).
 */
export function tokenBudgetForProfile(profile: ToolProfile): number {
  return calculateToolsTokenBudget(listToolsForProfile(profile));
}

export * from './act.js';
export * from './governance.js';
export * from './readonly.js';
export * from './webmcp.js';
