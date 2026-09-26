// @vitest-environment happy-dom
// AC-P14-02 (Prompt 14 §5): Popup renders the mockup structure with UNCHANGED visible labels.
// e2e selectors in tests/e2e/helpers/ui.ts depend on:
//   button:has-text("Kill Switch"), "Reset Kill Switch", "Enable Site Access & Inject"
//   span:has(span.rounded-full)  (status row wrapper)

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { App as PopupApp } from '../../entrypoints/popup/App.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface ChromeMock {
  runtime: {
    sendMessage: ReturnType<typeof vi.fn>;
    onMessage: { addListener: ReturnType<typeof vi.fn>; removeListener: ReturnType<typeof vi.fn> };
  };
  permissions: { request: ReturnType<typeof vi.fn> };
}

describe('Popup Light Ribbon structure (AC-P14-02)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let messageListeners: ((msg: unknown) => void)[] = [];

  beforeEach(() => {
    messageListeners = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const chromeMock: ChromeMock = {
      runtime: {
        sendMessage: vi.fn((_msg: unknown, callback?: (res: unknown) => void) => {
          // No transport answer → popup renders the "Not Connected" idle state.
          if (callback) callback(null);
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
    (globalThis as unknown as { chrome: unknown }).chrome = chromeMock;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  const renderPopup = async (): Promise<void> => {
    await act(async () => {
      root.render(React.createElement(PopupApp));
    });
  };

  test('renders the three action buttons with UNCHANGED labels', async () => {
    await renderPopup();

    const buttons = Array.from(container.querySelectorAll('button'));
    const labels = buttons.map((b) => b.textContent?.trim());
    expect(labels.some((l) => l?.includes('Kill Switch (HR-10)'))).toBe(true);
    expect(labels.some((l) => l?.includes('Reset Kill Switch'))).toBe(true);
    expect(labels.some((l) => l?.includes('Enable Site Access & Inject'))).toBe(true);
  });

  test('each action button uses its triad tint class (red / teal / blue)', async () => {
    await renderPopup();

    const killBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Kill Switch (HR-10)'),
    );
    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reset Kill Switch'),
    );
    const injectBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Enable Site Access & Inject'),
    );
    expect(killBtn?.className).toContain('bg-red-tint');
    expect(resetBtn?.className).toContain('bg-teal-tint');
    expect(injectBtn?.className).toContain('bg-blue-tint');
  });

  test('shows raster lockup img + Local mode pill in the header (AC-F14-01)', async () => {
    await renderPopup();

    const lockup = container.querySelector('img[alt="Tether"]');
    expect(lockup).not.toBeNull();
    expect(lockup?.getAttribute('src')).toBe('/brand-lockup.png');
    // No synthesized SVG monogram may render (AC-F14-06)
    expect(container.querySelector('svg path[stroke^="url"]')).toBeNull();
    // Mode pill: sunken pill next to the lockup
    expect(container.querySelector('.rounded-input.bg-sunken')).not.toBeNull();
    expect(container.textContent).toContain('Local');
  });

  test('shows two icon rows: Status sunken well, Clients brand-blue well (AC-F14-02)', async () => {
    await renderPopup();

    expect(container.textContent).toContain('Status:');
    expect(container.textContent).toContain('Clients:');
    const wells = container.querySelectorAll('.w-9.h-9.rounded-input');
    expect(wells.length).toBe(2);
    const [statusWell, clientsWell] = Array.from(wells);
    expect(statusWell?.className).toContain('bg-sunken');
    expect(statusWell?.className).toContain('text-teal-fg');
    expect(clientsWell?.className).toContain('bg-brand-blue');
    expect(clientsWell?.className).toContain('text-white');
  });

  test('status renders a rounded-full dot in every state: on / wait / off', async () => {
    // idle → off
    await act(async () => {
      root.render(React.createElement(PopupApp));
    });
    expect(container.querySelector('.bg-dot-off')).not.toBeNull();
    // online → on
    await act(async () => {
      for (const listener of messageListeners) {
        listener({ type: 'transport.state', state: 'online' });
      }
    });
    expect(container.querySelector('.bg-dot-on')).not.toBeNull();
    // backoff → wait
    await act(async () => {
      for (const listener of messageListeners) {
        listener({ type: 'transport.state', state: 'backoff' });
      }
    });
    expect(container.querySelector('.bg-dot-wait')).not.toBeNull();
    // The dot span stays inside a wrapper span (e2e span:has(span.rounded-full))
    const dot = container.querySelector('span.rounded-full');
    expect(dot?.parentElement?.tagName).toBe('SPAN');
  });

  test('idle state uses off-gray status (text-text-500 + dot-off)', async () => {
    await renderPopup();

    // No background answer → Not Connected: off-gray dot, text-500
    expect(container.querySelector('.bg-dot-off')).not.toBeNull();
    expect(container.querySelector('.text-text-500')).not.toBeNull();
  });

  test('popup card uses surface bg with card radius and shadow', async () => {
    await renderPopup();

    const card = container.firstElementChild as HTMLElement | null;
    expect(card?.className).toContain('w-[360px]');
    expect(card?.className).toContain('bg-surface');
    expect(card?.className).toContain('rounded-card');
    expect(card?.className).toContain('shadow-card');
  });

  test('renders 52px action buttons with stroke icons (no glyph characters)', async () => {
    await renderPopup();

    const killBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Kill Switch (HR-10)'),
    );
    expect(killBtn?.className).toContain('h-[52px]');
    expect(killBtn?.querySelector('svg')).not.toBeNull();
    // Glyph character replaced by SVG icon
    expect(killBtn?.textContent?.includes('⏻')).toBe(false);
  });
});
