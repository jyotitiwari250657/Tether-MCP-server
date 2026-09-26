// @vitest-environment happy-dom
/**
 * Popup & Sidepanel Transport Status Synchronization Tests (Prompt 09-FIX-03).
 * Verifies live UI state updates on mount queries and runtime state broadcasts.
 */

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { App as PopupApp } from '../../entrypoints/popup/App.js';
import { SessionTab } from '../../entrypoints/sidepanel/SessionTab.js';

// Tell React that this test environment supports act()
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Popup & Sidepanel Transport Status (AC-FIX3-01..AC-FIX3-04)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let messageListeners: ((msg: unknown) => void)[] = [];
  let bgStatusResponse: { state: string } | null = null;

  beforeEach(() => {
    messageListeners = [];
    bgStatusResponse = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        sendMessage: vi.fn((msg: unknown, callback?: (res: unknown) => void) => {
          if (
            msg &&
            typeof msg === 'object' &&
            (msg as Record<string, unknown>).type === 'get_transport_status'
          ) {
            if (bgStatusResponse && callback) {
              callback(bgStatusResponse);
            }
          }
          return Promise.resolve();
        }),
        onMessage: {
          addListener: vi.fn((fn: (msg: unknown) => void) => {
            messageListeners.push(fn);
          }),
          removeListener: vi.fn((fn: (msg: unknown) => void) => {
            messageListeners = messageListeners.filter((l) => l !== fn);
          }),
        },
      },
      permissions: {
        request: vi.fn().mockResolvedValue(true),
      },
    };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  // 1. mount with background answering online -> renders "Connected"
  test('AC-FIX3-01: mount with background answering online -> renders Connected', async () => {
    bgStatusResponse = { state: 'online' };

    await act(async () => {
      root.render(React.createElement(PopupApp));
    });

    expect(container.textContent).toContain('Connected');
    expect(container.textContent).not.toContain('Not connected');
    expect(container.querySelector('.text-teal-fg')).not.toBeNull();
  });

  // 2. mount with no answer then broadcast online -> renders "Connected"
  test('AC-FIX3-01: mount with no answer then broadcast online -> renders Connected', async () => {
    bgStatusResponse = null; // No initial answer

    await act(async () => {
      root.render(React.createElement(PopupApp));
    });

    expect(container.textContent).toContain('Not Connected');

    // Background broadcasts state transition
    await act(async () => {
      for (const listener of messageListeners) {
        listener({ type: 'transport.state', state: 'online' });
      }
    });

    expect(container.textContent).toContain('Connected');
    expect(container.querySelector('.text-teal-fg')).not.toBeNull();
  });

  // 3. broadcast backoff while open -> renders "Connecting…"
  test('AC-FIX3-02: broadcast backoff while open -> renders Connecting…', async () => {
    bgStatusResponse = { state: 'online' };

    await act(async () => {
      root.render(React.createElement(PopupApp));
    });

    expect(container.textContent).toContain('Connected');

    // Transport flips to backoff
    await act(async () => {
      for (const listener of messageListeners) {
        listener({ type: 'transport.state', state: 'backoff' });
      }
    });

    expect(container.textContent).toContain('Connecting…');
    expect(container.querySelector('.text-amber-fg')).not.toBeNull();
  });

  // 4. Side panel SessionTab shows matching live status line
  test('AC-FIX3-04: side panel SessionTab renders matching live transport status', async () => {
    bgStatusResponse = { state: 'online' };

    await act(async () => {
      root.render(React.createElement(SessionTab));
    });

    expect(container.textContent).toContain('Status:');
    expect(container.textContent).toContain('Connected');

    // Transport enters backoff
    await act(async () => {
      for (const listener of messageListeners) {
        listener({ type: 'transport.state', state: 'backoff' });
      }
    });

    expect(container.textContent).toContain('Connecting…');
    expect(container.querySelector('.text-amber-fg')).not.toBeNull();
  });
});
