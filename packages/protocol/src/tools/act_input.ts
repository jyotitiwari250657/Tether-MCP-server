/**
 * Form & Input Action Tools (PRD §10.2, TRD §5.4, TOOL-A03, A04, A05, A06, A16).
 */

import { z } from 'zod';
import type { ToolSpec } from './index.js';

// TOOL-A03: browser_type
export const browser_type: ToolSpec = {
  name: 'browser_type',
  title: 'Type',
  description: 'Type text into element.',
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
    text: z.string(),
    clear: z.boolean().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'WRITE' },
  budgetMs: 3000,
};

// TOOL-A04: browser_fill_form
export const browser_fill_form: ToolSpec = {
  name: 'browser_fill_form',
  title: 'Fill form',
  description: 'Fill multiple form fields. If secretId is present, value is ignored.',
  tier: 1,
  profiles: ['browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
  },
  input: z.object({
    fields: z.array(
      z.object({
        ref: z.string(),
        value: z.string(),
        secretId: z.string().optional(),
      }),
    ),
  }),
  output: z.object({
    ok: z.boolean(),
    count: z.number(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'WRITE' },
  budgetMs: 5000,
};

// TOOL-A05: browser_select
export const browser_select: ToolSpec = {
  name: 'browser_select',
  title: 'Select',
  description: 'Select dropdown option by value or label.',
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
    value: z.string().optional(),
    label: z.string().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'WRITE' },
  budgetMs: 1500,
};

// TOOL-A06: browser_press_key
export const browser_press_key: ToolSpec = {
  name: 'browser_press_key',
  title: 'Press key',
  description: 'Press key combination.',
  tier: 1,
  profiles: ['browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
  },
  input: z.object({
    keys: z.string(),
    ref: z.string().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'WRITE' },
  budgetMs: 1500,
};

// TOOL-A16: browser_type_secret (T2)
export const browser_type_secret: ToolSpec = {
  name: 'browser_type_secret',
  title: 'Type secret',
  description: 'Type secret credential into field.',
  tier: 2,
  profiles: ['browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
    idempotentHint: false,
  },
  input: z.object({
    ref: z.string(),
    secretId: z.string(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: {
    grant: 'WRITE',
    confirm: true,
    secret: true,
  },
  budgetMs: 3000,
};

export const ACT_INPUT_TOOLS: readonly ToolSpec<unknown, unknown>[] = [
  browser_type,
  browser_fill_form,
  browser_select,
  browser_press_key,
  browser_type_secret,
] as const;
