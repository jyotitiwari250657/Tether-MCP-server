/**
 * Navigation & Tab Action Tools (PRD §10.2, TRD §5.4, TOOL-A01, A10, A11).
 */

import { z } from 'zod';
import type { ToolSpec } from './index.js';

// TOOL-A01: browser_navigate
export const browser_navigate: ToolSpec = {
  name: 'browser_navigate',
  title: 'Navigate',
  description: 'Navigate tab to URL.',
  tier: 1,
  profiles: ['browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true,
    idempotentHint: true,
  },
  input: z.object({
    url: z.string(),
    tab: z.string().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'WRITE' },
  budgetMs: 5000,
};

// TOOL-A10: browser_wait_for
export const browser_wait_for: ToolSpec = {
  name: 'browser_wait_for',
  title: 'Wait for',
  description: 'Wait for text or selector on page.',
  tier: 1,
  profiles: ['browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    text: z.string().optional(),
    selector: z.string().optional(),
    state: z.string().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'READ' },
  budgetMs: 10000,
};

// TOOL-A11: browser_tabs (T1/T2 - T2 on close)
export const browser_tabs: ToolSpec = {
  name: 'browser_tabs',
  title: 'Tabs',
  description: 'Manage browser tabs.',
  tier: 1,
  profiles: ['browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
    idempotentHint: false,
  },
  input: z.object({
    action: z.enum(['new', 'close', 'select', 'duplicate']),
    url: z.string().optional(),
    tabId: z.string().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    tabId: z.string().optional(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'WRITE' },
  budgetMs: 3000,
};

export const ACT_NAV_TOOLS: readonly ToolSpec<unknown, unknown>[] = [
  browser_navigate,
  browser_wait_for,
  browser_tabs,
] as const;
