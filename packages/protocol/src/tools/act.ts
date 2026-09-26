/**
 * Action & DOM Mutation Tool Specifications (PRD §10.2, TRD §5.4, TOOL-A01..A17).
 * Aggregates sub-modules: act_click, act_input, act_nav, act_submit, act_task.
 */

import { ACT_CLICK_TOOLS } from './act_click.js';
import { ACT_INPUT_TOOLS } from './act_input.js';
import { ACT_NAV_TOOLS } from './act_nav.js';
import { ACT_SUBMIT_TOOLS } from './act_submit.js';
import { ACT_TASK_TOOLS } from './act_task.js';
import type { ToolSpec } from './index.js';

export * from './act_click.js';
export * from './act_input.js';
export * from './act_nav.js';
export * from './act_submit.js';
export * from './act_task.js';

export const ACT_TOOLS: readonly ToolSpec<unknown, unknown>[] = [
  ...ACT_CLICK_TOOLS,
  ...ACT_INPUT_TOOLS,
  ...ACT_NAV_TOOLS,
  ...ACT_SUBMIT_TOOLS,
  ...ACT_TASK_TOOLS,
] as const;
