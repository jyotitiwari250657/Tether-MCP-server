/**
 * Pointer & Movement Action Tools (PRD §10.2, TRD §5.4, TOOL-A02, A07, A08, A09).
 */

import { z } from 'zod';
import type { ToolSpec } from './index.js';

// TOOL-A02: browser_click
export const browser_click: ToolSpec = {
  name: 'browser_click',
  title: 'Click',
  description: 'Click element by ref.',
  tier: 1,
  profiles: ['browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
  },
  input: z.object({
    ref: z.string(),
    button: z.number().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'WRITE' },
  budgetMs: 1500,
};

// TOOL-A07: browser_scroll
export const browser_scroll: ToolSpec = {
  name: 'browser_scroll',
  title: 'Scroll',
  description: 'Scroll page or element.',
  tier: 1,
  profiles: ['browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    direction: z.enum(['up', 'down', 'left', 'right']),
    amount: z.number().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'WRITE' },
  budgetMs: 1500,
};

// TOOL-A08: browser_hover
export const browser_hover: ToolSpec = {
  name: 'browser_hover',
  title: 'Hover',
  description: 'Hover over element by ref.',
  tier: 1,
  profiles: ['browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    ref: z.string(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'WRITE' },
  budgetMs: 1500,
};

// TOOL-A09: browser_drag
export const browser_drag: ToolSpec = {
  name: 'browser_drag',
  title: 'Drag',
  description: 'Drag element from ref to ref.',
  tier: 1,
  profiles: ['browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
  },
  input: z.object({
    from: z.string(),
    to: z.string(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'WRITE' },
  budgetMs: 2500,
};

export const ACT_CLICK_TOOLS: readonly ToolSpec<unknown, unknown>[] = [
  browser_click,
  browser_scroll,
  browser_hover,
  browser_drag,
] as const;
