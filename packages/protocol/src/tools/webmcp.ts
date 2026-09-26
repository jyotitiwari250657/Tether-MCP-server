/**
 * WebMCP Proxy Tools (PRD §9.6, FR-621, TRD §6.15, TOOL-G08).
 * Namespaced site tool integration exposed across all profiles.
 */

import { z } from 'zod';
import type { ToolSpec } from './index.js';

// TOOL-G08: site_tools_list (T2)
export const site_tools_list: ToolSpec = {
  name: 'site_tools_list',
  title: 'List site tools',
  description: 'List site WebMCP tools.',
  tier: 2,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    tab: z.string().optional(),
  }),
  output: z.object({
    tools: z.array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
      }),
    ),
    trust: z.literal('untrusted'),
  }),
  requires: {
    grant: 'READ',
    confirm: true,
  },
  budgetMs: 3000,
};

// TOOL-G08: site_tools_call (T2)
export const site_tools_call: ToolSpec = {
  name: 'site_tools_call',
  title: 'Call site tool',
  description: 'Call site WebMCP tool.',
  tier: 2,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
    idempotentHint: false,
  },
  input: z.object({
    tab: z.string().optional(),
    tool: z.string(),
    args: z.record(z.unknown()).optional(),
  }),
  output: z.object({
    result: z.unknown(),
    trust: z.literal('untrusted'),
  }),
  requires: {
    grant: 'WRITE',
    confirm: true,
  },
  budgetMs: 10000,
};

export const WEBMCP_TOOLS: readonly ToolSpec<unknown, unknown>[] = [
  site_tools_list,
  site_tools_call,
] as const;
