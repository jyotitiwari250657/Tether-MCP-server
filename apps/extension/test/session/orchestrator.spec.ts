// @vitest-environment happy-dom
/**
 * Session Orchestrator & Dispatcher — routing/policy/audit behavior
 * (PRD FR-108, FR-109, FR-501..FR-513, TRD §6.3, §6.12).
 * Split from orchestrator.spec.ts for the TRD §4.3 300-line cap; error-conversion
 * and timeout specs live in orchestrator-errors.spec.ts.
 */

import type { Req, ResErr, ResOk } from '@tether/protocol';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { handleToolRequest } from '../../entrypoints/background.js';
import { endSession, startSession } from '../../lib/session/lifecycle.js';
import { dispatch } from '../../lib/session/orchestrator.js';
import { setupOrchestratorEnv } from './helpers.js';

describe('Session Orchestrator & Dispatcher (PRD FR-108, TRD §6.3)', () => {
  beforeEach(async () => {
    await setupOrchestratorEnv();
  });

  // 1. Snapshot redacts output & audits
  test('FR-203, FR-509: dispatch browser_snapshot redacts tree', async () => {
    const req: Req = {
      v: 1,
      id: 'req-snap',
      session: 's-1',
      ts: Date.now(),
      kind: 'req',
      tool: 'browser_snapshot',
      args: { url: 'http://localhost' },
      token: 'tok',
      idem: 'idem-1',
      budgetMs: 5000,
    };
    const res = await dispatch(req);
    expect(res.ok).toBe(true);
    expect(((res as ResOk).result as { tree: string }).tree).toContain('⟨EMAIL:u•••@example.com⟩');
  });

  // 2. Click, Type, PressKey, SelectOption, Scroll, Hover, Drag
  test('FR-207: dispatch action tools (click, type, pressKey, select, scroll, hover, drag, wait)', async () => {
    const expectOk = async (
      tool: string,
      args: Record<string, unknown>,
      id: string,
    ): Promise<void> => {
      const res = await dispatch({
        v: 1,
        id,
        session: 's',
        ts: 1,
        kind: 'req',
        tool,
        args,
        token: '',
        idem: id,
        budgetMs: 5000,
      } as unknown as Req);
      expect(res.ok).toBe(true);
    };

    // browser_click
    await expectOk('browser_click', { ref: 'A1', url: 'http://localhost' }, 'c1');
    // browser_type
    await expectOk('browser_type', { ref: 'A5', text: 'hi', url: 'http://localhost' }, 't1');
    // browser_press_key
    await expectOk('browser_press_key', { ref: 'A1', key: 'Enter', url: 'http://localhost' }, 'k1');
    // browser_select
    await expectOk('browser_select', { ref: 'A2', value: 'opt1', url: 'http://localhost' }, 's1');
    // browser_scroll
    await expectOk(
      'browser_scroll',
      { direction: 'down', amount: 50, url: 'http://localhost' },
      'sc1',
    );
    // browser_hover
    await expectOk('browser_hover', { ref: 'A1', url: 'http://localhost' }, 'h1');
    // browser_drag
    await expectOk('browser_drag', { from: 'A3', to: 'A4', url: 'http://localhost' }, 'd1');
    // browser_wait_for
    await expectOk('browser_wait_for', { selector: '#btn-submit', url: 'http://localhost' }, 'w1');
    // browser_find
    await expectOk('browser_find', { query: 'submit', url: 'http://localhost' }, 'f1');
  });

  // 3. Policy deny returns ResErr
  test('FR-503: policy deny returns ResErr on blocked sensitive category', async () => {
    const res = await dispatch({
      v: 1,
      id: 'b1',
      session: 's',
      ts: 1,
      kind: 'req',
      tool: 'browser_snapshot',
      args: { url: 'https://chase.com' },
      token: '',
      idem: 'b1',
      budgetMs: 5000,
    });
    expect(res.ok).toBe(false);
    expect((res as ResErr).error.code).toBe('POLICY_DENIED');
  });

  // 4. Policy ask returns NEEDS_CONFIRMATION
  test('HR-8, FR-507: policy ask returns NEEDS_CONFIRMATION on Tier 2 submit', async () => {
    const res = await dispatch({
      v: 1,
      id: 'a1',
      session: 's',
      ts: 1,
      kind: 'req',
      tool: 'browser_submit',
      args: { ref: 'A1', url: 'http://localhost' },
      token: '',
      idem: 'a1',
      budgetMs: 5000,
    });
    expect(res.ok).toBe(false);
    expect((res as ResErr).error.code).toBe('NEEDS_CONFIRMATION');
  });

  // 5. Background handler caching and step events
  test('AC-P05-19, FR-702: handleToolRequest caches idem and sends step message', async () => {
    const sendSpy = vi.spyOn(chrome.runtime, 'sendMessage');
    const req: Req = {
      v: 1,
      id: 'id-1',
      session: 's',
      ts: 1,
      kind: 'req',
      tool: 'browser_snapshot',
      args: { url: 'http://localhost' },
      token: '',
      idem: 'fixed-idem',
      budgetMs: 5000,
    };

    const res1 = await handleToolRequest(req);
    expect(res1.ok).toBe(true);
    expect(sendSpy).toHaveBeenCalled();

    const res2 = await handleToolRequest({ ...req, id: 'id-2' });
    expect(res2.ok).toBe(true);
    expect(res2.id).toBe('id-2');
  });

  // 6. Active session recordStep
  test('FR-508: records step into active session ledger', async () => {
    const sess = await startSession({
      id: 'sess-ledger',
      client: { id: 'c-1', label: 'Claude', scopes: ['browser:read', 'browser:write'] },
      mode: 'local',
    });

    const req: Req = {
      v: 1,
      id: 'step-req',
      session: sess.id,
      ts: 1,
      kind: 'req',
      tool: 'browser_snapshot',
      args: { url: 'http://localhost' },
      token: '',
      idem: 'idem-step',
      budgetMs: 5000,
    };
    const res = await dispatch(req);
    expect(res.ok).toBe(true);
    expect(sess.steps).toBeGreaterThan(0);
    expect(sess.lastCompletedStepId).toBe('step-req');

    await endSession('test_done');
  });

  // 7. snapshot on forbidden tab returns UNSUPPORTED_FRAME over WS (no timeout)
  test('snapshot on forbidden tab returns UNSUPPORTED_FRAME over WS (no timeout)', async () => {
    const chromeMock = (
      globalThis as unknown as {
        chrome: { windows: { getLastFocused: unknown }; tabs: { query: unknown } };
      }
    ).chrome;
    chromeMock.windows.getLastFocused = vi.fn().mockResolvedValue({
      tabs: [{ id: 9, url: 'chrome://newtab', active: true }],
    });
    chromeMock.tabs.query = vi
      .fn()
      .mockResolvedValue([{ id: 9, url: 'chrome://newtab', active: true }]);
    const t0 = performance.now();
    const res = await dispatch({
      v: 1,
      id: 'req-forbidden',
      session: 's',
      ts: 1,
      kind: 'req',
      tool: 'browser_snapshot',
      args: {},
      token: '',
      idem: 'idem-f',
      budgetMs: 5000,
    });
    expect(performance.now() - t0).toBeLessThan(100);
    expect(res.ok).toBe(false);
    expect((res as ResErr).error.code).toBe('UNSUPPORTED_FRAME');
    expect((res as ResErr).error.hint).toContain('Switch to a normal http(s) page');
  });
});
