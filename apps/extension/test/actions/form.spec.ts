// @vitest-environment happy-dom
/**
 * Form Actions Tests (PRD FR-207..FR-210, TRD §6.5).
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { pressKey, select } from '../../lib/actions/form.js';
import type { NodeHandle } from '../../lib/refs/types.js';

describe('Action Executor — Form Controls (PRD FR-207, TRD §6.5)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select id="country-select">
        <option value="us">United States</option>
        <option value="ca">Canada</option>
        <option value="uk">United Kingdom</option>
      </select>
      <input id="key-target" />
    `;
  });

  // 1. select by value
  test('FR-207: select chooses option matching value', async () => {
    const sel = document.getElementById('country-select') as HTMLSelectElement;
    const handle: NodeHandle = { node: sel, ref: 'A1' };

    await select(handle, { value: 'ca' });
    expect(sel.value).toBe('ca');
  });

  // 2. select by label
  test('FR-207: select chooses option matching label text', async () => {
    const sel = document.getElementById('country-select') as HTMLSelectElement;
    const handle: NodeHandle = { node: sel, ref: 'A1' };

    await select(handle, { label: 'United Kingdom' });
    expect(sel.value).toBe('uk');
  });

  // 3. select by index
  test('FR-207: select chooses option matching numeric index', async () => {
    const sel = document.getElementById('country-select') as HTMLSelectElement;
    const handle: NodeHandle = { node: sel, ref: 'A1' };

    await select(handle, { index: 0 });
    expect(sel.value).toBe('us');
  });

  // 4. select dispatches input and change events
  test('FR-207: select dispatches change and input events on select element', async () => {
    const sel = document.getElementById('country-select') as HTMLSelectElement;
    const handle: NodeHandle = { node: sel, ref: 'A1' };

    const events: string[] = [];
    sel.addEventListener('input', () => events.push('input'));
    sel.addEventListener('change', () => events.push('change'));

    await select(handle, { value: 'ca' });
    expect(events).toEqual(['input', 'change']);
  });

  // 5. pressKey dispatches keydown, keypress, keyup with modifiers
  test('FR-207: pressKey dispatches key sequence with modifiers', async () => {
    const inp = document.getElementById('key-target') as HTMLInputElement;
    const handle: NodeHandle = { node: inp, ref: 'A1' };

    const events: { type: string; key: string; ctrl: boolean }[] = [];
    for (const evtName of ['keydown', 'keypress', 'keyup']) {
      inp.addEventListener(evtName, (e: Event) => {
        const ke = e as KeyboardEvent;
        events.push({ type: ke.type, key: ke.key, ctrl: ke.ctrlKey });
      });
    }

    await pressKey(handle, { key: 'Enter', modifiers: { ctrl: true } });

    expect(events.map((e) => e.type)).toEqual(['keydown', 'keyup']);
    expect(events[0]?.ctrl).toBe(true);

    // 1-character printable key dispatches keypress
    const singleKeyEvents: string[] = [];
    inp.addEventListener('keypress', () => singleKeyEvents.push('keypress'));
    await pressKey(handle, { key: 'x' });
    expect(singleKeyEvents).toEqual(['keypress']);
  });
});
