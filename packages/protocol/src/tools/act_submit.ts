/**
 * High-Risk Mutation & Dialog Tools (PRD §10.2, TRD §5.4, TOOL-A12, A13, A14, A15).
 * All Tier 2 tools require explicit human confirmation (HR-8).
 */

import { z } from 'zod';
import type { ToolSpec } from './index.js';

// TOOL-A12: browser_submit (T2)
export const browser_submit: ToolSpec = {
  name: 'browser_submit',
  title: 'Submit',
  description: 'Submit form by ref with confirm token.',
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
    confirmToken: z.string(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: {
    grant: 'WRITE',
    confirm: true,
  },
  budgetMs: 5000,
};

// TOOL-A13: browser_dialog (T2)
export const browser_dialog: ToolSpec = {
  name: 'browser_dialog',
  title: 'Dialog',
  description: 'Accept or dismiss dialog.',
  tier: 2,
  profiles: ['browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
    idempotentHint: false,
  },
  input: z.object({
    action: z.enum(['accept', 'dismiss']),
    text: z.string().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: {
    grant: 'WRITE',
    confirm: true,
  },
  budgetMs: 2000,
};

// TOOL-A14: browser_download (T2)
export const browser_download: ToolSpec = {
  name: 'browser_download',
  title: 'Download',
  description: 'Download file from page.',
  tier: 2,
  profiles: ['browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
    idempotentHint: false,
  },
  input: z.object({
    ref: z.string().optional(),
    url: z.string().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    path: z.string().optional(),
    trust: z.literal('tether'),
  }),
  requires: {
    grant: 'WRITE',
    confirm: true,
  },
  budgetMs: 15000,
};

// TOOL-A15: browser_upload (T2)
export const browser_upload: ToolSpec = {
  name: 'browser_upload',
  title: 'Upload',
  description: 'Upload file to input element.',
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
    path: z.string(),
  }),
  output: z.object({
    ok: z.boolean(),
    trust: z.literal('tether'),
  }),
  requires: {
    grant: 'WRITE',
    confirm: true,
  },
  budgetMs: 5000,
};

export const ACT_SUBMIT_TOOLS: readonly ToolSpec<unknown, unknown>[] = [
  browser_submit,
  browser_dialog,
  browser_download,
  browser_upload,
] as const;
