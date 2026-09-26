/**
 * Session Tool Dispatcher & Orchestrator (TRD §6.3, §6.6, §6.7, §6.9, PRD FR-108).
 * Evaluates policy, executes tool, redacts result, appends to audit chain, and emits step events.
 */

import {
  type Req,
  type Res,
  type ResErr,
  type ResOk,
  TOOLS,
  type ToolError,
  canonicalJson,
} from '@tether/protocol';
import { append } from '../audit/index.js';
import { decide, load as loadPolicy } from '../policy/index.js';
import { redact } from '../redact/index.js';
import { debugLogger } from './debug-logger.js';
import { executeDomTool } from './dom-runner.js';
import { getActiveSession, isPowerMode } from './lifecycle.js';
import { ensureInjected, isDomTool, resolveTargetTab, withTimeout } from './target.js';

interface VaultHandler {
  typeIn(ref: string, secretId: string): Promise<void>;
}

let vaultInstance: VaultHandler | null = null;

export function setVaultClient(v: VaultHandler | null): void {
  vaultInstance = v;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digestBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digestBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function makeResOk(req: Req, result: unknown, start: number): ResOk {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const ms = Math.max(1, Math.round(now - start));
  debugLogger.logToolResult(req.tool, { ok: true, result }, ms);
  return {
    v: 1,
    id: req.id,
    session: req.session || 'default',
    ts: Date.now(),
    kind: 'res',
    reqId: req.id,
    ok: true,
    result,
    ms,
  };
}

function makeResErr(req: Req, error: ToolError, start: number): ResErr {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const ms = Math.max(1, Math.round(now - start));
  debugLogger.logToolResult(req.tool, { ok: false, code: error.code }, ms);
  return {
    v: 1,
    id: req.id,
    session: req.session || 'default',
    ts: Date.now(),
    kind: 'res',
    reqId: req.id,
    ok: false,
    error,
    ms,
  };
}

async function executeTool(
  toolName: string,
  reqArgs: Record<string, unknown>,
  targetTabId: number | null,
): Promise<unknown> {
  if (toolName === 'browser_type_secret') {
    if (!vaultInstance) {
      throw {
        code: 'NEEDS_CONFIRMATION',
        message: 'Vault requires daemon connection. Connect the daemon to use secrets.',
        hint: 'Connect the daemon to use secrets',
        retryable: true,
      };
    }
    await vaultInstance.typeIn(String(reqArgs.ref ?? ''), String(reqArgs.secretId ?? ''));
    return { ok: true, trust: 'tether' };
  }

  if (
    targetTabId !== null &&
    typeof chrome !== 'undefined' &&
    chrome.tabs?.sendMessage &&
    typeof document === 'undefined'
  ) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        targetTabId,
        { type: 'tether_tool', tool: toolName, args: reqArgs },
        (response) => {
          const lastErr = chrome.runtime?.lastError;
          if (lastErr) {
            return reject({
              code: 'INTERNAL',
              message: `Failed to communicate with tab: ${lastErr.message}`,
              hint: 'Ensure site access is enabled for this tab',
              retryable: true,
            } as ToolError);
          }
          if (!response) {
            return reject({
              code: 'INTERNAL',
              message: 'Empty response from content script',
              hint: 'The page may have navigated or closed',
              retryable: true,
            } as ToolError);
          }
          if (response.ok) {
            resolve(response.result);
          } else {
            reject(response.error);
          }
        },
      );
    });
  }

  return executeDomTool(toolName, reqArgs);
}

export async function dispatch(req: Req): Promise<Res> {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  debugLogger.logToolCall(req.tool, req.args, start);
  try {
    const { tool, args, session = 'default' } = req;
    const reqArgs = (args && typeof args === 'object' ? args : {}) as Record<string, unknown>;
    const argsDigest = await sha256Hex(canonicalJson(args));

    const spec = TOOLS.find((t) => t.name === tool);
    if (!spec) {
      return makeResErr(
        req,
        {
          code: 'INTERNAL',
          message: `Unknown tool "${tool}"`,
          hint: 'Verify tool registry',
          retryable: false,
        },
        start,
      );
    }
    if (typeof reqArgs.confirmToken === 'string') {
      return makeResErr(
        req,
        {
          code: 'CONFIRM_TOKEN_INVALID',
          message: 'Confirmation token invalid or consumed',
          hint: 'Request confirmation',
          retryable: false,
        },
        start,
      );
    }

    let targetTabUrl = '';
    let targetTabId: number | null = null;
    if (isDomTool(tool)) {
      const target = await resolveTargetTab(reqArgs.tab as string | undefined);
      if ('code' in target) {
        return makeResErr(req, target, start);
      }
      reqArgs.tab = String(target.tabId);
      targetTabUrl = target.url;
      targetTabId = target.tabId;
    }

    const activeSess = getActiveSession();
    const origin =
      typeof reqArgs.url === 'string' ? reqArgs.url : targetTabUrl || 'http://localhost';
    const policyStore = await loadPolicy();

    const decision = decide(
      {
        tool: spec,
        origin,
        tier: spec.tier,
        session,
        clientScopes: activeSess?.client.scopes ?? [
          'browser:read',
          'browser:write',
          'browser:sensitive',
        ],
        powerMode: isPowerMode(),
      },
      policyStore,
    );

    if (decision.verdict === 'deny') {
      await append({
        t: new Date().toISOString(),
        session,
        client: activeSess?.client.id ?? 'client',
        mode: activeSess?.mode ?? 'local',
        tool,
        tier: spec.tier,
        argsDigest,
        verdict: 'deny',
      });
      return makeResErr(
        req,
        {
          code: decision.code ?? 'POLICY_DENIED',
          message: decision.reason,
          hint: 'Action denied by policy',
          retryable: false,
        },
        start,
      );
    }

    if (decision.verdict === 'ask') {
      await append({
        t: new Date().toISOString(),
        session,
        client: activeSess?.client.id ?? 'client',
        mode: activeSess?.mode ?? 'local',
        tool,
        tier: spec.tier,
        argsDigest,
        verdict: 'ask',
      });
      return makeResErr(
        req,
        {
          code: 'NEEDS_CONFIRMATION',
          message: decision.reason,
          hint: 'User approval required',
          retryable: true,
          details: { diff: decision.diff },
        },
        start,
      );
    }

    if (targetTabId !== null) {
      const injected = await ensureInjected(targetTabId);
      if (injected !== true) {
        return makeResErr(req, injected, start);
      }
    }

    const budgetMs = Math.min(req.budgetMs ?? 20000, 20000);
    const timeoutErr: ToolError = {
      code: 'TIMEOUT',
      message: `Tool execution "${tool}" timed out after ${budgetMs}ms`,
      hint: 'Extension-side budget exceeded; retry or use browser_task_start.',
      retryable: true,
    };
    const rawResult = await withTimeout(
      executeTool(tool, reqArgs, targetTabId),
      budgetMs,
      timeoutErr,
    );
    const { redacted, hits } = redact(rawResult);

    await append({
      t: new Date().toISOString(),
      session,
      client: activeSess?.client.id ?? 'client',
      mode: activeSess?.mode ?? 'local',
      tool,
      tier: spec.tier,
      argsDigest,
      verdict: 'allow',
      redactionHits: hits.map((h) => ({ kind: h.kind, count: 1 })),
    });

    if (activeSess) {
      activeSess.steps++;
      activeSess.lastCompletedStepId = req.id;
    }

    return makeResOk(req, redacted, start);
  } catch (err: unknown) {
    const toolError: ToolError =
      typeof err === 'object' && err !== null && 'code' in err
        ? (err as ToolError)
        : {
            code: 'INTERNAL',
            message: err instanceof Error ? err.message : 'Execution error',
            hint: 'Tool execution threw an error',
            retryable: false,
          };
    return makeResErr(req, toolError, start);
  }
}
