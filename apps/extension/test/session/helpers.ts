// @vitest-environment happy-dom
/**
 * TRD §4.3: shared environment setup for the session orchestrator specs.
 * Extracted from orchestrator.spec.ts so each spec file stays under the 300-line cap.
 */

import type { PolicyRule } from '@tether/protocol';
import { vi } from 'vitest';
import { clearAuditChain } from '../../lib/audit/index.js';
import { grant } from '../../lib/policy/index.js';
import { clearNodeRegistries, liveNodeMap, liveRefMap } from '../../lib/refs/snapshot.js';

/** Installs the chrome mock, DOM fixture, ref/node maps and localhost WRITE grant. */
export async function setupOrchestratorEnv(): Promise<void> {
  clearNodeRegistries();
  await clearAuditChain();

  const storageMap = new Map<string, unknown>();
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      session: {
        get: vi.fn(async (key: string | string[]) => {
          if (Array.isArray(key)) {
            const res: Record<string, unknown> = {};
            for (const k of key) res[k] = storageMap.get(k);
            return res;
          }
          return { [key]: storageMap.get(key) };
        }),
        set: vi.fn(async (obj: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(obj)) storageMap.set(k, v);
        }),
        remove: vi.fn(async (key: string) => {
          storageMap.delete(key);
        }),
      },
      local: {
        get: vi.fn(async (key: string) => ({ [key]: storageMap.get(key) })),
        set: vi.fn(async (obj: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(obj)) storageMap.set(k, v);
        }),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
    },
    tabs: {
      get: vi.fn().mockResolvedValue({ id: 1, url: 'http://localhost' }),
      query: vi.fn().mockResolvedValue([{ id: 1, url: 'http://localhost', active: true }]),
      sendMessage: vi.fn().mockResolvedValue({ pong: true }),
    },
    windows: {
      getLastFocused: vi.fn().mockResolvedValue({
        tabs: [{ id: 1, url: 'http://localhost', active: true }],
      }),
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([{ result: true }]),
    },
  };

  document.body.innerHTML = `
    <div>
      <button id="btn-submit">Submit Form</button>
      <input id="input-txt" aria-label="Username" value="" />
      <select id="select-opt" aria-label="Select"><option value="opt1">Opt 1</option></select>
      <div id="drag-src" role="generic">Src</div>
      <div id="drag-dst" role="generic">Dst</div>
      <p>Receipt sent to user@example.com</p>
    </div>
  `;

  const btn = document.getElementById('btn-submit') as HTMLButtonElement;
  const inp = document.getElementById('input-txt') as HTMLInputElement;
  const sel = document.getElementById('select-opt') as HTMLSelectElement;
  const src = document.getElementById('drag-src') as HTMLElement;
  const dst = document.getElementById('drag-dst') as HTMLElement;

  liveRefMap.set('A1', {
    ref: 'A1',
    frame: 'F0',
    nodeId: 1,
    cssPath: '#btn-submit',
    xpath: '//*[@id="btn-submit"]',
    role: 'button',
    name: 'Submit Form',
    textSig: 'test',
    rect: { x: 10, y: 10, w: 100, h: 30 },
    interactive: true,
  });
  liveRefMap.set('A2', {
    ref: 'A2',
    frame: 'F0',
    nodeId: 2,
    cssPath: '#select-opt',
    xpath: '//*[@id="select-opt"]',
    role: 'combobox',
    name: 'Select',
    textSig: 'test',
    rect: { x: 10, y: 50, w: 100, h: 30 },
    interactive: true,
  });
  liveRefMap.set('A3', {
    ref: 'A3',
    frame: 'F0',
    nodeId: 3,
    cssPath: '#drag-src',
    xpath: '//*[@id="drag-src"]',
    role: 'generic',
    name: 'Src',
    textSig: 'test',
    rect: { x: 0, y: 0, w: 50, h: 50 },
    interactive: true,
  });
  liveRefMap.set('A4', {
    ref: 'A4',
    frame: 'F0',
    nodeId: 4,
    cssPath: '#drag-dst',
    xpath: '//*[@id="drag-dst"]',
    role: 'generic',
    name: 'Dst',
    textSig: 'test',
    rect: { x: 100, y: 100, w: 50, h: 50 },
    interactive: true,
  });
  liveRefMap.set('A5', {
    ref: 'A5',
    frame: 'F0',
    nodeId: 5,
    cssPath: '#input-txt',
    xpath: '//*[@id="input-txt"]',
    role: 'textbox',
    name: 'Username',
    textSig: 'test',
    rect: { x: 10, y: 80, w: 100, h: 30 },
    interactive: true,
  });

  liveNodeMap.set(1, btn);
  liveNodeMap.set(2, sel);
  liveNodeMap.set(3, src);
  liveNodeMap.set(4, dst);
  liveNodeMap.set(5, inp);

  const rule: PolicyRule = {
    id: 'r-local',
    match: { kind: 'exact', value: 'localhost' },
    level: 'WRITE',
    scope: 'persistent',
    actor: 'user',
    createdAt: Date.now(),
  };
  await grant(rule);
}
