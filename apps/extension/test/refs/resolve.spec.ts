// @vitest-environment happy-dom
/**
 * Self-Healing Ref Resolution Tests (PRD FR-204, TRD §6.4.4).
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { calculateScore, levenshtein, nameSim, resolve, verify } from '../../lib/refs/resolve.js';
import { clearNodeRegistries, liveNodeMap, liveRefMap, snapshot } from '../../lib/refs/snapshot.js';
import type { RefEntry } from '../../lib/refs/types.js';

describe('Ref Engine — Self-Healing Resolution (PRD FR-204, TRD §6.4.4)', () => {
  beforeEach(() => {
    clearNodeRegistries();
    document.body.innerHTML = '';
  });

  // 1. Step 1: live nodeId returns node
  test('FR-204: step 1 resolves directly via live nodeId when node is connected', async () => {
    document.body.innerHTML = '<button id="btn">Submit</button>';
    await snapshot(1, {}, document.body);

    const outcome = await resolve('A1');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.handle.node.id).toBe('btn');
      expect(outcome.healed).toBeUndefined();
    }
  });

  // 2. Step 2: cssPath + textSig verification
  test('FR-204: step 2 heals via cssPath when original node detaches but replaced', async () => {
    document.body.innerHTML = '<div id="container"><button id="btn">Confirm</button></div>';
    await snapshot(1, {}, document.body);

    // Simulate SPA DOM re-render: detach original node from liveNodeMap
    const oldEntry = liveRefMap.get('A1');
    if (!oldEntry) throw new Error('A1 entry not found');
    liveNodeMap.delete(oldEntry.nodeId); // disconnect live handle

    // Replace with identical new node at same cssPath
    const container = document.getElementById('container');
    if (!container) throw new Error('container not found');
    container.innerHTML = '<button id="btn">Confirm</button>';

    const outcome = await resolve('A1');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.handle.node.id).toBe('btn');
      expect(outcome.healed).toBe(true);
      expect(outcome.healDetail).toContain('cssPath');
    }
  });

  // 3. Step 3: xpath + textSig verification
  test('FR-204: step 3 heals via xpath when css selector fails but xpath matches', async () => {
    document.body.innerHTML = '<div><button id="checkout-btn">Checkout</button></div>';
    await snapshot(1, {}, document.body);

    const btnRef = Array.from(liveRefMap.values()).find((e) => e.role === 'button')?.ref ?? 'A1';
    const entry = liveRefMap.get(btnRef);
    if (!entry) throw new Error('btnRef entry not found');
    liveNodeMap.delete(entry.nodeId);
    entry.cssPath = '#invalid-selector-path'; // force Step 2 to fail

    // Mock document.evaluate to return the button with matching textSig
    const button = document.getElementById('checkout-btn');
    if (!button) throw new Error('checkout button not found');
    document.evaluate = vi.fn().mockReturnValue({ singleNodeValue: button });

    const outcome = await resolve(btnRef);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.healed).toBe(true);
      expect(outcome.healDetail).toContain('xpath');
    }
  });

  // 4. Step 4: fuzzy match by role + name similarity (>= 0.85)
  test('FR-204: step 4 heals via fuzzy match within landmark when text slightly changed', async () => {
    document.body.innerHTML = '<main><button>Sign In to Account</button></main>';
    await snapshot(1, {}, document.body);

    const btnRef = Array.from(liveRefMap.values()).find((e) => e.role === 'button')?.ref ?? 'A2';
    const entry = liveRefMap.get(btnRef);
    if (!entry) throw new Error('btnRef entry not found');
    liveNodeMap.delete(entry.nodeId);
    entry.cssPath = '#none';
    entry.xpath = '/none';

    // Slightly mutated text ("Sign In to Accounts" -> similarity > 0.90)
    const mainEl = document.querySelector('main');
    if (!mainEl) throw new Error('main element not found');
    mainEl.innerHTML = '<button>Sign In to Accounts</button>';

    const outcome = await resolve(btnRef);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.healed).toBe(true);
      expect(outcome.healDetail).toContain('fuzzy match');
    }
  });

  // 5. Step 5: REF_STALE when no candidate matches (AC-P05-12)
  test('FR-204, AC-P05-12: step 5 returns REF_STALE with up to 5 candidates when unmatchable', async () => {
    document.body.innerHTML = `
      <main>
        <button>Delete</button>
        <button>Cancel</button>
      </main>
    `;
    await snapshot(1, {}, document.body);

    const btnRef = Array.from(liveRefMap.values()).find((e) => e.name === 'Delete')?.ref ?? 'A2';
    const entry = liveRefMap.get(btnRef);
    if (!entry) throw new Error('Delete button ref not found');
    liveNodeMap.delete(entry.nodeId);
    entry.cssPath = '#none';
    entry.xpath = '/none';
    entry.name = 'CompletelyDifferentActionButton';

    const outcome = await resolve(btnRef);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('REF_STALE');
      expect(outcome.error.details).toBeDefined();
      const candidates = (outcome.error.details as { candidates: unknown[] }).candidates;
      expect(candidates.length).toBeLessThanOrEqual(5);
    }
  });

  // 6. verify() checks role and name similarity
  test('FR-204: verify() returns false on role mismatch or name similarity < 0.85', () => {
    const btn = document.createElement('button');
    btn.textContent = 'Save';

    const mockEntry: RefEntry = {
      ref: 'A1',
      frame: 'F0',
      nodeId: 1,
      cssPath: 'button',
      xpath: '//button',
      role: 'link', // Mismatched role
      name: 'Save',
      textSig: 'test',
      rect: { x: 0, y: 0, w: 100, h: 40 },
      interactive: true,
    };

    expect(verify(btn, mockEntry)).toBe(false);

    mockEntry.role = 'button';
    mockEntry.name = 'Entirely Different Action Name';
    expect(verify(btn, mockEntry)).toBe(false);
  });

  // 7. nameSim() accuracy
  test('FR-204: nameSim computes 1.0 for identical and < 0.3 for completely different strings', () => {
    expect(nameSim('Submit Order', 'Submit Order')).toBe(1.0);
    expect(nameSim('Submit Order', 'Submit Orders')).toBeGreaterThan(0.9);
    expect(nameSim('Submit Order', 'Cancel')).toBeLessThan(0.3);
  });

  // 8. Levenshtein distance (AC-P05-10)
  test('FR-204, AC-P05-10: hand-rolled levenshtein distance computes correct edit distances', () => {
    expect(levenshtein('', '')).toBe(0);
    expect(levenshtein('a', '')).toBe(1);
    expect(levenshtein('', 'b')).toBe(1);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('book', 'back')).toBe(2);
  });

  // 9. Score weighting: 0.50 role + 0.30 name + 0.20 proximity
  test('FR-204: score calculation uses 0.50 role, 0.30 name, 0.20 proximity weighting', () => {
    const entry: RefEntry = {
      ref: 'A1',
      frame: 'F0',
      nodeId: 1,
      cssPath: 'button',
      xpath: '//button',
      role: 'button',
      name: 'Save',
      textSig: 'test',
      rect: { x: 100, y: 100, w: 50, h: 20 },
      interactive: true,
    };

    // Perfect match
    const perfectScore = calculateScore('button', 'Save', { x: 100, y: 100, w: 50, h: 20 }, entry);
    expect(perfectScore).toBeCloseTo(1.0, 2);

    // Mismatched role (-0.50)
    const roleMismatchScore = calculateScore(
      'link',
      'Save',
      { x: 100, y: 100, w: 50, h: 20 },
      entry,
    );
    expect(roleMismatchScore).toBeCloseTo(0.5, 2);
  });

  // 10. REF_NOT_FOUND on missing ref
  test('FR-204: returns REF_NOT_FOUND when ref does not exist in refMap', async () => {
    const outcome = await resolve('Z99');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('REF_NOT_FOUND');
    }
  });
});
