/**
 * Read-Only Tool Specifications (PRD §10.2, TRD §5.4, TOOL-R01..R10).
 * Included in both 'browser-readonly' and 'browser-act' profiles.
 */

import { z } from 'zod';
import type { ToolSpec } from './index.js';

// TOOL-R01: browser_snapshot
export const browser_snapshot: ToolSpec = {
  name: 'browser_snapshot',
  title: 'Snapshot',
  description: 'Capture DOM a11y tree snapshot with refs.',
  tier: 0,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    tab: z.string().optional(),
    format: z.enum(['markdown', 'a11y']).optional(),
    refs: z.boolean().optional(),
  }),
  output: z.object({
    tree: z.string(),
    truncated: z.boolean(),
    url: z.string(),
    title: z.string(),
    trust: z.literal('untrusted'),
  }),
  requires: { grant: 'READ' },
  budgetMs: 2000,
};

// TOOL-R02: browser_get_text
export const browser_get_text: ToolSpec = {
  name: 'browser_get_text',
  title: 'Get text',
  description: 'Get readable text from ref or selector.',
  tier: 0,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    ref: z.string().optional(),
    selector: z.string().optional(),
  }),
  output: z.object({
    text: z.string(),
    trust: z.literal('untrusted'),
  }),
  requires: { grant: 'READ' },
  budgetMs: 1500,
};

// TOOL-R03: browser_screenshot
// Prompt 11 (HR-5 additive only): ocrRedact / redactStyle are optional input
// fields; ocrRedactionHits / ocrDegraded are optional output fields.
// Existing callers are unaffected (PRD HR-5, SEC-05 screenshot residual risk).
export const browser_screenshot: ToolSpec = {
  name: 'browser_screenshot',
  title: 'Screenshot',
  description: 'Capture page or element screenshot.',
  tier: 0,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    ref: z.string().optional(),
    fullPage: z.boolean().optional(),
    // Prompt 11: daemon-side native OCR secret redaction (default on)
    ocrRedact: z.boolean().optional(),
    redactStyle: z.enum(['blur', 'black']).optional(),
  }),
  output: z.object({
    dataUrl: z.string(),
    trust: z.literal('untrusted'),
    ocrRedactionHits: z.number().optional(),
    ocrDegraded: z.boolean().optional(),
  }),
  requires: { grant: 'READ' },
  budgetMs: 3000,
};

// TOOL-R04: browser_list_tabs
export const browser_list_tabs: ToolSpec = {
  name: 'browser_list_tabs',
  title: 'List tabs',
  description: 'List open browser tabs.',
  tier: 0,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({}),
  output: z.object({
    tabs: z.array(
      z.object({
        id: z.string(),
        url: z.string(),
        title: z.string(),
        active: z.boolean(),
      }),
    ),
  }),
  requires: { grant: 'READ' },
  budgetMs: 1000,
};

// TOOL-R05: browser_find
export const browser_find: ToolSpec = {
  name: 'browser_find',
  title: 'Find',
  description: 'Find element refs matching query.',
  tier: 0,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    query: z.string(),
    scope: z.string().optional(),
    limit: z.number().optional(),
  }),
  output: z.object({
    matches: z.array(
      z.object({
        ref: z.string(),
        role: z.string(),
        name: z.string(),
      }),
    ),
  }),
  requires: { grant: 'READ' },
  budgetMs: 2000,
};

// TOOL-R06: browser_read_console
export const browser_read_console: ToolSpec = {
  name: 'browser_read_console',
  title: 'Console',
  description: 'Read browser console messages.',
  tier: 0,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    levels: z.array(z.string()).optional(),
    since: z.number().optional(),
  }),
  output: z.object({
    entries: z.array(
      z.object({
        level: z.string(),
        text: z.string(),
      }),
    ),
  }),
  requires: { grant: 'READ' },
  budgetMs: 1000,
};

// TOOL-R07: browser_list_network
export const browser_list_network: ToolSpec = {
  name: 'browser_list_network',
  title: 'Network',
  description: 'List page network requests.',
  tier: 0,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
    idempotentHint: true,
  },
  input: z.object({
    filter: z.string().optional(),
  }),
  output: z.object({
    entries: z.array(
      z.object({
        url: z.string(),
        method: z.string(),
        status: z.number(),
      }),
    ),
  }),
  requires: { grant: 'READ' },
  budgetMs: 1000,
};
// TOOL-R08: browser_extract
export const browser_extract: ToolSpec = {
  name: 'browser_extract',
  title: 'Extract',
  description: 'Extract structured data using schema.',
  tier: 0,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    schema: z.record(z.unknown()),
  }),
  output: z.object({
    data: z.unknown(),
  }),
  requires: { grant: 'READ' },
  budgetMs: 8000,
};
// TOOL-R09: search
export const search: ToolSpec = {
  name: 'search',
  title: 'Search',
  description: 'Search company knowledge or web.',
  tier: 0,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
    idempotentHint: true,
  },
  input: z.object({
    query: z.string(),
    topK: z.number().optional(),
  }),
  output: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string(),
      }),
    ),
  }),
  requires: { grant: 'READ' },
  budgetMs: 5000,
};
// TOOL-R10: fetch
export const fetch: ToolSpec = {
  name: 'fetch',
  title: 'Fetch',
  description: 'Fetch URL content as markdown.',
  tier: 0,
  profiles: ['browser-readonly', 'browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: true,
    idempotentHint: true,
  },
  input: z.object({
    url: z.string(),
    maxBytes: z.number().optional(),
  }),
  output: z.object({
    markdown: z.string(),
    status: z.number(),
    trust: z.literal('untrusted'),
  }),
  requires: { grant: 'READ' },
  budgetMs: 10000,
};

export const READONLY_TOOLS: readonly ToolSpec<unknown, unknown>[] = [
  browser_snapshot,
  browser_get_text,
  browser_screenshot,
  browser_list_tabs,
  browser_find,
  browser_read_console,
  browser_list_network,
  browser_extract,
  search,
  fetch,
] as const;
