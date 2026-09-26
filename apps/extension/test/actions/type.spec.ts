// @vitest-environment happy-dom
/**
 * Type & Form Action Tests (PRD FR-208, TRD §6.5).
 */

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, test } from 'vitest';
import { fillForm, setValue, type } from '../../lib/actions/type.js';
import { clearNodeRegistries, liveRefMap, snapshot } from '../../lib/refs/snapshot.js';
import type { NodeHandle } from '../../lib/refs/types.js';

describe('Action Executor — Type & Values (PRD FR-208, TRD §6.5)', () => {
  beforeEach(() => {
    clearNodeRegistries();
    document.body.innerHTML = '';
  });

  // 1. Plain input value setter dispatches input + change + blur
  test('FR-208: setValue updates value and dispatches input, change, blur events', () => {
    document.body.innerHTML = '<input id="test-input" type="text" />';
    const input = document.getElementById('test-input') as HTMLInputElement;

    const events: string[] = [];
    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));
    input.addEventListener('blur', () => events.push('blur'));

    setValue(input, 'hello world');

    expect(input.value).toBe('hello world');
    expect(events).toEqual(['input', 'change', 'blur']);
  });

  // 2. React-controlled input registers change (AC-P05-14)
  test('FR-208, AC-P05-14: type into a React-controlled input updates React state', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    let reactState = '';
    function ControlledForm() {
      const [value, setValueState] = useState('');
      reactState = value;
      return React.createElement('input', {
        id: 'react-controlled',
        value,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValueState(e.target.value),
      });
    }

    const root = createRoot(container);
    root.render(React.createElement(ControlledForm));

    // Allow initial render
    await new Promise((r) => setTimeout(r, 20));

    const input = document.getElementById('react-controlled') as HTMLInputElement;
    const handle: NodeHandle = { node: input, ref: 'A1' };

    await type(handle, { text: 'tether-ai', jitterMs: 0 });

    expect(input.value).toBe('tether-ai');
    expect(reactState).toBe('tether-ai');
  });

  // 3. Clear option clears existing value before typing
  test('FR-208: clear option clears existing value before appending new text', async () => {
    document.body.innerHTML = '<input id="text-inp" value="old text" />';
    const input = document.getElementById('text-inp') as HTMLInputElement;
    const handle: NodeHandle = { node: input, ref: 'A1' };

    await type(handle, { text: 'new text', clear: true, jitterMs: 0 });
    expect(input.value).toBe('new text');
  });

  // 4. Textarea prototype setter works
  test('FR-208: setValue and type work on textarea elements', async () => {
    document.body.innerHTML = '<textarea id="area"></textarea>';
    const area = document.getElementById('area') as HTMLTextAreaElement;
    const handle: NodeHandle = { node: area, ref: 'A1' };

    await type(handle, { text: 'line1\nline2', jitterMs: 0 });
    expect(area.value).toBe('line1\nline2');
  });

  // 5. Human-like jitter timing
  test('FR-208: type without jitterMs override uses human jitter range (18-45ms)', async () => {
    document.body.innerHTML = '<input id="jitter-inp" />';
    const input = document.getElementById('jitter-inp') as HTMLInputElement;
    const handle: NodeHandle = { node: input, ref: 'A1' };

    const start = performance.now();
    await type(handle, { text: 'abc' });
    const elapsed = performance.now() - start;

    // 3 characters with 18-45ms each should take at least ~35ms
    expect(elapsed).toBeGreaterThanOrEqual(30);
  });

  // 6. fillForm fills multiple fields
  test('FR-208: fillForm fills multiple inputs simultaneously', async () => {
    document.body.innerHTML = `
      <form>
        <input id="first" name="first" />
        <input id="last" name="last" />
      </form>
    `;
    await snapshot(1, {}, document.body);

    const firstRef =
      Array.from(liveRefMap.values()).find((e) => e.cssPath.includes('first'))?.ref ?? 'A2';
    const lastRef =
      Array.from(liveRefMap.values()).find((e) => e.cssPath.includes('last'))?.ref ?? 'A3';

    await fillForm([
      { ref: firstRef, value: 'Grace' },
      { ref: lastRef, value: 'Hopper' },
    ]);

    const firstInp = document.getElementById('first') as HTMLInputElement;
    const lastInp = document.getElementById('last') as HTMLInputElement;

    expect(firstInp.value).toBe('Grace');
    expect(lastInp.value).toBe('Hopper');
  });

  // 7. fillForm with secretId returns NEEDS_CONFIRMATION (AC-P05-16)
  test('FR-208, AC-P05-16: fillForm with secretId returns NEEDS_CONFIRMATION error', async () => {
    document.body.innerHTML = '<input id="pwd" type="password" />';
    await snapshot(1, {}, document.body);

    await expect(fillForm([{ ref: 'A1', secretId: 'vault://banking-pin' }])).rejects.toMatchObject({
      code: 'NEEDS_CONFIRMATION',
      hint: expect.stringContaining('confirmation'),
    });
  });

  // 8. Result shape matches PRD FR-210
  test('FR-210: type returns ActionResult with timing and metadata', async () => {
    document.body.innerHTML = '<input id="meta-inp" />';
    const input = document.getElementById('meta-inp') as HTMLInputElement;
    const handle: NodeHandle = { node: input, ref: 'A1' };

    const result = await type(handle, { text: 'test', jitterMs: 0 });

    expect(result.ok).toBe(true);
    expect(result.role).toBe('textbox');
    expect(result.trust).toBe('tether');
  });

  // 9. browser_fill_form with a label ref -> resolves to input and fills (AC-FIX7-02)
  test('FR-208: browser_fill_form with a label ref resolves to associated input and fills', async () => {
    document.body.innerHTML = `
      <label for="email-field">Email Address</label>
      <input id="email-field" type="email" />
    `;
    await snapshot(1, {}, document.body);
    const labelRef =
      Array.from(liveRefMap.values()).find((e) => e.role === 'label' || e.name.includes('Email'))
        ?.ref ?? 'A1';

    await fillForm([{ ref: labelRef, value: 'alice@example.com' }]);

    const input = document.getElementById('email-field') as HTMLInputElement;
    expect(input.value).toBe('alice@example.com');
  });

  // 10. browser_fill_form with a React-controlled input -> React state updates (AC-FIX7-02)
  test('FR-208: browser_fill_form with a React-controlled input updates React state', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    let reactState = '';
    function ControlledComponent() {
      const [val, setVal] = useState('');
      reactState = val;
      return React.createElement('input', {
        id: 'react-fill-input',
        value: val,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setVal(e.target.value),
      });
    }

    const root = createRoot(container);
    root.render(React.createElement(ControlledComponent));
    await new Promise((r) => setTimeout(r, 20));

    await snapshot(1, {}, document.body);
    const ref =
      Array.from(liveRefMap.values()).find((e) => e.cssPath.includes('react-fill-input'))?.ref ??
      'A1';

    await fillForm([{ ref, value: 'react-fill-value' }]);

    const input = document.getElementById('react-fill-input') as HTMLInputElement;
    expect(input.value).toBe('react-fill-value');
    expect(reactState).toBe('react-fill-value');
  });

  // 11. browser_fill_form with a disabled input -> waits for enabled (AC-FIX7-02)
  test('FR-208: browser_fill_form with a temporarily disabled input waits for enabled state', async () => {
    document.body.innerHTML = '<input id="delayed-input" disabled />';
    await snapshot(1, {}, document.body);
    const input = document.getElementById('delayed-input') as HTMLInputElement;

    setTimeout(() => {
      input.disabled = false;
    }, 50);

    await fillForm([{ ref: 'A1', value: 'enabled-value' }]);

    expect(input.value).toBe('enabled-value');
  });
});
