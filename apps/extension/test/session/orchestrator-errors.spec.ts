// @vitest-environment happy-dom
/**
 * Session Orchestrator — error conversion and timeout guards (PRD FR-108, HR-11, TRD §6.3).
 * Split from orchestrator.spec.ts for the TRD §4.3 300-line cap.
 */

import type { Req, ResErr } from '@tether/protocol';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as refs from '../../lib/refs/index.js';
import { dispatch } from '../../lib/session/orchestrator.js';
import { withTimeout } from '../../lib/session/target.js';
import { setupOrchestratorEnv } from './helpers.js';

describe('Session Orchestrator — error guards (HR-11, TRD §6.3)', () => {
  beforeEach(async () => {
    await setupOrchestratorEnv();
  });

  // 1. Action failure converts to ToolError
  test('HR-11: action failure returns structured ToolError', async () => {
    const res = await dispatch({
      v: 1,
      id: 'm1',
      session: 's',
      ts: 1,
      kind: 'req',
      tool: 'browser_click',
      args: { ref: 'Z99', url: 'http://localhost' },
      token: '',
      idem: 'm1',
      budgetMs: 5000,
    });
    expect(res.ok).toBe(false);
    expect((res as ResErr).error.code).toBe('REF_NOT_FOUND');
  });

  // 2. Unknown tool returns INTERNAL
  test('HR-11: unknown tool returns INTERNAL error', async () => {
    const res = await dispatch({
      v: 1,
      id: 'u1',
      session: 's',
      ts: 1,
      kind: 'req',
      tool: 'missing_tool',
      args: {},
      token: '',
      idem: 'u1',
      budgetMs: 5000,
    });
    expect(res.ok).toBe(false);
    expect((res as ResErr).error.code).toBe('INTERNAL');
  });

  // 3. Tool execution unhandled error returns INTERNAL
  test('HR-11: tool throwing unexpected non-tool error converts to INTERNAL', async () => {
    const snapSpy = vi
      .spyOn(refs, 'snapshot')
      .mockRejectedValueOnce(new Error('Unexpected DOM crash'));
    const req: Req = {
      v: 1,
      id: 'err-req',
      session: 's',
      ts: 1,
      kind: 'req',
      tool: 'browser_snapshot',
      args: { url: 'http://localhost' },
      token: '',
      idem: 'idem-err',
      budgetMs: 5000,
    };
    const res = await dispatch(req);
    expect(res.ok).toBe(false);
    expect((res as ResErr).error.code).toBe('INTERNAL');
    expect((res as ResErr).error.message).toContain('Unexpected DOM crash');
    snapSpy.mockRestore();
  });

  // 4. Swallowed rejection inside an action still yields ResErr INTERNAL
  test('swallowed rejection inside an action still yields ResErr INTERNAL (unhandled-rejection guard)', async () => {
    const snapSpy = vi.spyOn(refs, 'snapshot').mockImplementationOnce(() => {
      throw new Error('Uncaught critical failure');
    });
    const res = await dispatch({
      v: 1,
      id: 'req-fail',
      session: 's',
      ts: 1,
      kind: 'req',
      tool: 'browser_snapshot',
      args: { url: 'http://localhost' },
      token: '',
      idem: 'idem-fail',
      budgetMs: 5000,
    });
    expect(res.ok).toBe(false);
    expect((res as ResErr).error.code).toBe('INTERNAL');
    snapSpy.mockRestore();
  });

  // 5. withTimeout fires at 20 s when handler never resolves (fake timers)
  test('withTimeout fires at 20 s when handler never resolves', async () => {
    vi.useFakeTimers();
    const neverResolves = new Promise<string>(() => {});
    const wrapped = withTimeout(neverResolves, 20000);

    const rejectionPromise = expect(wrapped).rejects.toMatchObject({
      code: 'TIMEOUT',
      hint: 'Extension-side budget exceeded; retry or use browser_task_start.',
    });

    vi.advanceTimersByTime(20000);
    await rejectionPromise;
    vi.useRealTimers();
  });
});
