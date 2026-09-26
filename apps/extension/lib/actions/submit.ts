/**
 * Form Submission Action (PRD FR-207, HR-8, TRD §6.5).
 * Submissions are Tier 2 (T2) actions requiring explicit per-action confirmation with diff.
 */

import type { ToolError } from '@tether/protocol';
import type { NodeHandle } from '../refs/types.js';
import type { ActionResult, SubmitOpts } from './types.js';

export async function submit(handle: NodeHandle, _opts: SubmitOpts = {}): Promise<ActionResult> {
  const form = (
    handle.node.tagName.toUpperCase() === 'FORM' ? handle.node : handle.node.closest('form')
  ) as HTMLFormElement | null;

  const formAction = form?.getAttribute('action') ?? 'current-page';
  const method = form?.getAttribute('method') ?? 'GET';
  const inputs = form ? Array.from(form.querySelectorAll('input, select, textarea')) : [];
  const fields = inputs
    .map((inp) =>
      inp.getAttribute('name')
        ? `${inp.getAttribute('name')}=${(inp as HTMLInputElement).value}`
        : '',
    )
    .filter(Boolean)
    .join(', ');

  const error: ToolError = {
    code: 'NEEDS_CONFIRMATION',
    message: `Form submission requires confirmation (action: ${formAction}, method: ${method})`,
    hint: `T2 action requires user approval diff. Fields: [${fields || 'none'}]`,
    retryable: false,
    details: {
      action: formAction,
      method,
      fields,
    },
  };

  throw error;
}
