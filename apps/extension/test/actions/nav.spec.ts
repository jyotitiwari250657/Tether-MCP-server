// @vitest-environment happy-dom
/**
 * Navigation, Tabs, and Submission Tests (PRD FR-207, FR-210, HR-8, TRD §6.5).
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { guardCovered, isVisible } from '../../lib/actions/common.js';
import { dialog } from '../../lib/actions/dialog.js';
import { drag } from '../../lib/actions/drag.js';
import { navigate, tabs } from '../../lib/actions/nav.js';
import { hover, scroll } from '../../lib/actions/scroll.js';
import { submit } from '../../lib/actions/submit.js';
import { clearNodeRegistries, liveNodeMap, liveRefMap } from '../../lib/refs/snapshot.js';
import type { NodeHandle } from '../../lib/refs/types.js';

describe('Action Executor — Navigation & T2 Controls (PRD FR-207, HR-8, TRD §6.5)', () => {
  beforeEach(() => {
    clearNodeRegistries();
    document.body.innerHTML = `
      <form id="test-form" action="/checkout" method="POST">
        <input name="item" value="book" />
        <input name="qty" value="2" />
        <button type="submit">Pay</button>
      </form>
      <div id="drag-source">Source</div>
      <div id="drag-target">Target</div>
      <div id="scroll-target">Scroll Target</div>
    `;

    // Chrome mock
    (globalThis as unknown as { chrome: unknown }).chrome = {
      tabs: {
        create: vi.fn(async () => ({ id: 101 })),
        update: vi.fn(async (_idOrObj: unknown) => ({ id: 101 })),
        duplicate: vi.fn(async (_id: number) => ({ id: 102 })),
      },
    };
  });

  // 1. navigate sets location or calls chrome.tabs.update
  test('FR-207: navigate updates location when chrome.tabs is available', async () => {
    const updateSpy = vi.spyOn(chrome.tabs, 'update');

    await navigate({ url: 'https://example.com/products', tab: '101' });
    expect(updateSpy).toHaveBeenCalledWith(101, { url: 'https://example.com/products' });

    await navigate({ url: 'https://example.com/home' });
    expect(updateSpy).toHaveBeenCalledWith({ url: 'https://example.com/home' });
  });

  // 2. tabs actions
  test('FR-207: tabs executes new, select, duplicate actions', async () => {
    const createSpy = vi.spyOn(chrome.tabs, 'create');
    const updateSpy = vi.spyOn(chrome.tabs, 'update');
    const duplicateSpy = vi.spyOn(chrome.tabs, 'duplicate');

    await tabs({ action: 'new' });
    expect(createSpy).toHaveBeenCalled();

    await tabs({ action: 'select', tabId: 202 });
    expect(updateSpy).toHaveBeenCalledWith(202, { active: true });

    await tabs({ action: 'duplicate', tabId: 202 });
    expect(duplicateSpy).toHaveBeenCalledWith(202);
  });

  // 3. tabs close returns NEEDS_CONFIRMATION (AC-P05-17)
  test('FR-207, HR-8, AC-P05-17: tabs({action: "close"}) returns NEEDS_CONFIRMATION error', async () => {
    await expect(tabs({ action: 'close', tabId: 42 })).rejects.toMatchObject({
      code: 'NEEDS_CONFIRMATION',
      hint: expect.stringContaining('T2'),
    });
  });

  // 4. submit returns NEEDS_CONFIRMATION with diff details (AC-P05-17)
  test('FR-207, HR-8, AC-P05-17: submit returns NEEDS_CONFIRMATION error with diff details', async () => {
    const form = document.getElementById('test-form') as HTMLFormElement;
    const handle: NodeHandle = { node: form, ref: 'A1' };

    await expect(submit(handle)).rejects.toMatchObject({
      code: 'NEEDS_CONFIRMATION',
      details: expect.objectContaining({
        action: '/checkout',
        method: 'POST',
        fields: expect.stringContaining('item=book'),
      }),
    });

    // Submit invoked on a button inside the form
    const button = form.querySelector('button') as HTMLButtonElement;
    await expect(submit({ node: button, ref: 'A2' })).rejects.toMatchObject({
      code: 'NEEDS_CONFIRMATION',
      details: expect.objectContaining({
        action: '/checkout',
      }),
    });

    // Submit invoked on element outside form
    const nonForm = document.createElement('div');
    await expect(submit({ node: nonForm, ref: 'A3' })).rejects.toMatchObject({
      code: 'NEEDS_CONFIRMATION',
      details: expect.objectContaining({
        action: 'current-page',
        method: 'GET',
      }),
    });
  });

  // 5. dialog returns NEEDS_CONFIRMATION
  test('TRD §6.5: dialog action returns NEEDS_CONFIRMATION error', async () => {
    await expect(dialog({ action: 'accept' })).rejects.toMatchObject({
      code: 'NEEDS_CONFIRMATION',
    });
  });

  // 6. scroll covers all directions and ref targeting
  test('FR-207: scroll dispatches in up, left, right, down directions and ref scrolling', async () => {
    const scrollBySpy = vi.fn();
    window.scrollBy = scrollBySpy;

    await scroll({ direction: 'up', amount: 150 });
    expect(scrollBySpy).toHaveBeenCalledWith({ left: 0, top: -150, behavior: 'instant' });

    await scroll({ direction: 'left', amount: 50 });
    expect(scrollBySpy).toHaveBeenCalledWith({ left: -50, top: 0, behavior: 'instant' });

    await scroll({ direction: 'right', amount: 80 });
    expect(scrollBySpy).toHaveBeenCalledWith({ left: 80, top: 0, behavior: 'instant' });

    await scroll({ direction: 'down', amount: 200 });
    expect(scrollBySpy).toHaveBeenCalledWith({ left: 0, top: 200, behavior: 'instant' });

    // Scroll target ref into view
    const target = document.getElementById('scroll-target');
    if (!target) throw new Error('scroll-target not found');
    const scrollIntoViewSpy = vi.fn();
    target.scrollIntoView = scrollIntoViewSpy;

    liveRefMap.set('A9', {
      ref: 'A9',
      frame: 'F0',
      nodeId: 99,
      cssPath: '#scroll-target',
      xpath: '//*[@id="scroll-target"]',
      role: 'generic',
      name: 'Scroll Target',
      textSig: 'test',
      rect: { x: 0, y: 0, w: 10, h: 10 },
      interactive: false,
    });
    liveNodeMap.set(99, target);

    const refResult = await scroll({ ref: 'A9' });
    expect(refResult.ok).toBe(true);
    expect(scrollIntoViewSpy).toHaveBeenCalled();
  });

  // 7. hover and drag dispatch pointer events
  test('FR-207: hover and drag dispatch pointer events', async () => {
    const src = document.getElementById('drag-source');
    const dst = document.getElementById('drag-target');
    if (!src || !dst) throw new Error('drag elements not found');
    src.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      top: 0,
      left: 0,
      right: 50,
      bottom: 50,
      toJSON: () => {},
    });
    dst.getBoundingClientRect = () => ({
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      top: 100,
      left: 100,
      right: 150,
      bottom: 150,
      toJSON: () => {},
    });

    const hoverResult = await hover({ node: src, ref: 'A1' });
    expect(hoverResult.ok).toBe(true);

    const dragResult = await drag({ node: src, ref: 'A1' }, { node: dst, ref: 'A2' });
    expect(dragResult.ok).toBe(true);
  });

  // 8. isVisible and guardCovered overlay dismissal
  test('FR-207: isVisible checks styles and guardCovered dismisses overlay button', () => {
    const hiddenEl = document.createElement('div');
    hiddenEl.style.display = 'none';
    document.body.appendChild(hiddenEl);
    expect(isVisible(hiddenEl)).toBe(false);

    const visibleEl = document.createElement('div');
    document.body.appendChild(visibleEl);
    expect(isVisible(visibleEl)).toBe(true);

    // Overlay dismissal
    const overlay = document.createElement('div');
    overlay.className = 'cookie-banner';
    const dismissBtn = document.createElement('button');
    overlay.appendChild(dismissBtn);
    document.body.appendChild(overlay);

    let dismissed = false;
    dismissBtn.onclick = () => {
      dismissed = true;
      overlay.remove();
    };

    let callCount = 0;
    document.elementFromPoint = vi.fn().mockImplementation(() => {
      callCount++;
      return callCount === 1 ? dismissBtn : visibleEl;
    });

    const coveredResult = guardCovered(visibleEl);
    expect(dismissed).toBe(true);
    expect(coveredResult).toBe(true);
  });
});
