/**
 * Diagnostic Debug Logger (Prompt 09-FIX-07).
 * Opt-in low-overhead logger for tool calls, ref resolutions, and DOM mutations.
 *
 * Bundle diet (TRD §11, P10 Task 1): in production builds `import.meta.env.DEV`
 * is replaced with `false` by Vite's define pass, so the full implementation
 * below is dead code and is tree-shaken out; what ships is the no-op stub.
 * Dev and test builds (`import.meta.env.DEV === true`) keep full behaviour.
 */

export interface DebugLogEntry {
  ts: string;
  type: 'tool_call' | 'tool_result' | 'ref_resolve' | 'dom_op';
  detail: Record<string, unknown>;
}

interface DebugLogger {
  enabled: boolean;
  logToolCall(tool: string, args: unknown, startTime?: number): void;
  logToolResult(tool: string, result: unknown, durationMs: number): void;
  logRefResolution(ref: string, element: Element | null, context?: string): void;
  logDomOperation(
    operation: string,
    element: Element | null,
    details?: Record<string, unknown>,
  ): void;
  getLogs(): readonly DebugLogEntry[];
  clear(): void;
}

let debugLogger: DebugLogger;

if (import.meta.env.DEV) {
  class FullDebugLogger implements DebugLogger {
    enabled = false;
    private readonly logs: DebugLogEntry[] = [];

    logToolCall(tool: string, args: unknown, startTime = Date.now()): void {
      if (!this.enabled) return;
      const argsDigest =
        typeof args === 'object' && args !== null
          ? Object.keys(args as Record<string, unknown>).join(',')
          : String(args);
      this.logs.push({
        ts: new Date(startTime).toISOString(),
        type: 'tool_call',
        detail: { tool, argsDigest, startTime },
      });
    }

    logToolResult(tool: string, result: unknown, durationMs: number): void {
      if (!this.enabled) return;
      const ok =
        typeof result === 'object' && result !== null && 'ok' in result
          ? (result as { ok: boolean }).ok
          : true;
      const code =
        typeof result === 'object' && result !== null && 'code' in result
          ? (result as { code: string }).code
          : undefined;
      this.logs.push({
        ts: new Date().toISOString(),
        type: 'tool_result',
        detail: { tool, ok, code, durationMs },
      });
    }

    logRefResolution(ref: string, element: Element | null, context?: string): void {
      if (!this.enabled) return;
      const tagName = element?.tagName?.toLowerCase() ?? 'none';
      const role = element?.getAttribute?.('role') ?? 'implicit';
      const id = element?.id ?? '';
      this.logs.push({
        ts: new Date().toISOString(),
        type: 'ref_resolve',
        detail: { ref, tagName, role, id, context },
      });
    }

    logDomOperation(
      operation: string,
      element: Element | null,
      details?: Record<string, unknown>,
    ): void {
      if (!this.enabled) return;
      const tagName = element?.tagName?.toLowerCase() ?? 'none';
      const id = element?.id ?? '';
      this.logs.push({
        ts: new Date().toISOString(),
        type: 'dom_op',
        detail: { operation, tagName, id, ...(details ?? {}) },
      });
    }

    getLogs(): readonly DebugLogEntry[] {
      return this.logs;
    }

    clear(): void {
      this.logs.length = 0;
    }
  }

  debugLogger = new FullDebugLogger();
} else {
  // Production: structural no-op. Same call signature, zero retained state.
  const noopLogs: readonly DebugLogEntry[] = [];
  debugLogger = {
    enabled: false,
    logToolCall() {},
    logToolResult() {},
    logRefResolution() {},
    logDomOperation() {},
    getLogs() {
      return noopLogs;
    },
    clear() {},
  };
}

export { debugLogger };
