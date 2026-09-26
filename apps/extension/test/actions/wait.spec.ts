// @vitest-environment happy-dom
/**
 * Wait Action Tests (PRD FR-209, TRD §6.5).
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { waitFor } from '../../lib/actions/wait.js';

describe('Action Executor — Wait (PRD FR-209, TRD §6.5)', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div>Initial Content</div>';
  });

  // 1. Strictly NO setInterval (AC-P05-15)
  test('FR-209, AC-P05-15: waitFor uses MutationObserver and rAF, never calls setInterval', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    // Element is already present
    await waitFor({ text: 'Initial' });

    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  // 2. Resolves when selector appears dynamically
  test('FR-209: resolves when selector appears via DOM mutation', async () => {
    const waitPromise = waitFor({ selector: '#async-element', timeoutMs: 1000 });

    setTimeout(() => {
      const dynamicEl = document.createElement('div');
      dynamicEl.id = 'async-element';
      dynamicEl.textContent = 'Loaded asynchronously';
      document.body.appendChild(dynamicEl);
    }, 50);

    const result = await waitPromise;
    expect(result.ok).toBe(true);
  });

  // 3. Resolves when text appears dynamically
  test('FR-209: resolves when target text appears via DOM mutation', async () => {
    const waitPromise = waitFor({ text: 'Success Message', timeoutMs: 1000 });

    setTimeout(() => {
      const msg = document.createElement('p');
      msg.textContent = 'Transaction complete: Success Message received';
      document.body.appendChild(msg);
    }, 50);

    const result = await waitPromise;
    expect(result.ok).toBe(true);
  });

  // 4. Times out with TIMEOUT error when element does not appear
  test('FR-209: rejects with TIMEOUT ToolError when condition is not met within timeoutMs', async () => {
    await expect(
      waitFor({ selector: '#non-existent-element', timeoutMs: 100 }),
    ).rejects.toMatchObject({
      code: 'TIMEOUT',
      retryable: true,
    });
  });
});
