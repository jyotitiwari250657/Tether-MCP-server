// TRD §4.3: ToolError normalization extracted from TransportClient (300-line cap).
// PRD HR-11: failures cross the wire as structured ToolErrors, never bare throws.
import type { ToolError } from '@tether/protocol';

/** Hint used when the extension request handler itself fails (HR-11). */
export const INTERNAL_HANDLER_HINT = 'Internal error in extension request handler';

/** Normalizes an unknown throw into a structured ToolError (HR-11). */
export function normalizeToolError(err: unknown, internalHint: string): ToolError {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return err as ToolError;
  }
  return {
    code: 'INTERNAL',
    message: err instanceof Error ? err.message : String(err),
    hint: internalHint,
    retryable: false,
  };
}
