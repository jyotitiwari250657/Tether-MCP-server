/**
 * Asynchronous Task Management Tools (PRD §10.2, TRD §5.4, TOOL-A17).
 * Implements resumable task handles for operations exceeding 30s ceiling (HR-9).
 */

import { z } from 'zod';
import type { ToolSpec } from './index.js';

// TOOL-A17: browser_task_start
export const browser_task_start: ToolSpec = {
  name: 'browser_task_start',
  title: 'Task start',
  description: 'Start async task and get taskId.',
  tier: 1,
  profiles: ['browser-act'],
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
  },
  input: z.object({
    task: z.string(),
  }),
  output: z.object({
    taskId: z.string(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'WRITE' },
  budgetMs: 1000,
  resumable: true,
};

// TOOL-A17: browser_task_status
export const browser_task_status: ToolSpec = {
  name: 'browser_task_status',
  title: 'Task status',
  description: 'Check status of async task.',
  tier: 1,
  profiles: ['browser-act'],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
  input: z.object({
    taskId: z.string(),
  }),
  output: z.object({
    status: z.string(),
    progress: z.number().optional(),
    trust: z.literal('tether'),
  }),
  requires: { grant: 'READ' },
  budgetMs: 1000,
  resumable: true,
};

export const ACT_TASK_TOOLS: readonly ToolSpec<unknown, unknown>[] = [
  browser_task_start,
  browser_task_status,
] as const;
