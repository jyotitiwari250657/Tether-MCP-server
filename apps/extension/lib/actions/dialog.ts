/**
 * Dialog Action Executor (TRD §6.5, ADR-006).
 * Dialog interception requires chrome.debugger which is deferred; returns NEEDS_CONFIRMATION.
 */

import type { ToolError } from '@tether/protocol';
import type { ActionResult, DialogAction } from './types.js';

export async function dialog(action: DialogAction): Promise<ActionResult> {
  const error: ToolError = {
    code: 'NEEDS_CONFIRMATION',
    message: `Dialog ${action.action} action requires explicit user confirmation`,
    hint: 'Dialog handling is an interactive capability requiring confirmation',
    retryable: false,
  };
  throw error;
}
