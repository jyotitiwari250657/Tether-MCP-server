// @vitest-environment happy-dom
/**
 * Click Action Executor Tests (PRD FR-207, FR-210, TRD §6.5).
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { click } from '../../lib/actions/click.js';
import type { NodeHandle } from '../../lib/refs/types.js';

describe('Action Executor — Click (PRD FR-207, FR-210, TRD §6.5)', () => {
  let button: HTMLButtonElement;
  let handle: NodeHandle;

  beforeEach(() => {
    document.body.innerHTML = '<button id="target-btn">Click Target</button>';
    button = document.getElementById('target-btn') as HTMLButtonElement;
    button.getBoundingClientRect = () => ({
      x: 100,
      y: 200,
      width: 80,
      height: 40,
      top: 200,
      left: 100,
      right: 180,
      bottom: 240,
      toJSON: () => {},
    });
    // Default elementFromPoint returns the target button
    document.elementFromPoint = vi.fn().mockImplementation(() => button);
    handle = { node: button, ref: 'A1' };
  });

  // 1. Full 8-event sequence in exact order (AC-P05-13)
  test('FR-207, AC-P05-13: dispatches exact 8-event pointer+mouse sequence in order', async () => {
    const receivedEvents: string[] = [];
    const eventTypes = [
      'pointerover',
      'pointerenter',
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ];

    for (const type of eventTypes) {
      button.addEventListener(type, () => receivedEvents.push(type));
    }

    await click(handle);

    expect(receivedEvents).toEqual([
      'pointerover',
      'pointerenter',
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ]);
  });

  // 2. Center clientX and clientY calculation
  test('FR-207: computes clientX and clientY at element center', async () => {
    let capturedClientX = 0;
    let capturedClientY = 0;

    button.addEventListener('click', (e) => {
      capturedClientX = e.clientX;
      capturedClientY = e.clientY;
    });

    await click(handle);

    // left: 100, width: 80 -> center X = 140; top: 200, height: 40 -> center Y = 220
    expect(capturedClientX).toBe(140);
    expect(capturedClientY).toBe(220);
  });

  // 3. Scroll into view before click
  test('FR-207: scrolls target into view with center alignment', async () => {
    const scrollSpy = vi.fn();
    button.scrollIntoView = scrollSpy;

    await click(handle);

    expect(scrollSpy).toHaveBeenCalledWith({
      block: 'center',
      inline: 'center',
      behavior: 'instant',
    });
  });

  // 4. Modifiers passed through
  test('FR-207: passes modifier keys (ctrl, shift, alt, meta) through events', async () => {
    let capturedModifiers = { ctrl: false, shift: false, alt: false, meta: false };

    button.addEventListener('click', (e) => {
      capturedModifiers = {
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
      };
    });

    await click(handle, {
      modifiers: { ctrl: true, shift: true, alt: false, meta: true },
    });

    expect(capturedModifiers).toEqual({
      ctrl: true,
      shift: true,
      alt: false,
      meta: true,
    });
  });

  // 5. guardCovered rejects when overlay covers element
  test('FR-207: throws REF_STALE when element is covered by an unresolvable overlay', async () => {
    const overlay = document.createElement('div');
    overlay.id = 'blocking-overlay';
    document.body.appendChild(overlay);

    document.elementFromPoint = vi.fn().mockReturnValue(overlay);

    await expect(click(handle)).rejects.toMatchObject({
      code: 'REF_STALE',
      hint: expect.stringContaining('overlay'),
    });
  });

  // 6. Result shape matches PRD FR-210
  test('FR-210: returns valid ActionResult shape', async () => {
    const result = await click(handle);

    expect(result).toMatchObject({
      ok: true,
      ref: 'A1',
      role: 'button',
      name: 'Click Target',
      domChanged: true,
      trust: 'tether',
    });
    expect(typeof result.ms).toBe('number');
    expect(typeof result.urlAfter).toBe('string');
  });

  // 7. Button click triggers standard onClick handler
  test('FR-207: triggers attached onclick event listener', async () => {
    let clicked = false;
    button.onclick = () => {
      clicked = true;
    };

    await click(handle);
    expect(clicked).toBe(true);
  });

  // 8. Custom mouse button (e.g. middle click)
  test('FR-207: forwards non-primary mouse button', async () => {
    let capturedButton = -1;
    button.addEventListener('pointerdown', (e) => {
      capturedButton = e.button;
    });

    await click(handle, { button: 1 });
    expect(capturedButton).toBe(1);
  });
});
