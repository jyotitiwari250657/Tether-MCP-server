// @vitest-environment node
/**
 * Bounded Queue Unit Tests (PRD FR-401, TRD §6.11).
 */

import type { EnvelopeType, Evt } from '@tether/protocol';
import { describe, expect, test } from 'vitest';
import { BoundedQueue } from '../../lib/transport/queue.js';

describe('BoundedQueue (PRD FR-401, TRD §6.11)', () => {
  test('FR-401: BoundedQueue drops oldest non-req messages on overflow', () => {
    const queue = new BoundedQueue<EnvelopeType>(3);
    const evt1: Evt = { v: 1, id: '1', session: 's', ts: 1, kind: 'evt', evt: 'step', payload: {} };
    const evt2: Evt = { v: 1, id: '2', session: 's', ts: 2, kind: 'evt', evt: 'step', payload: {} };
    const req1: EnvelopeType = {
      v: 1,
      id: 'r1',
      session: 's',
      ts: 3,
      kind: 'req',
      tool: 't',
      args: {},
      token: '',
      idem: '1',
      budgetMs: 1000,
    };
    const evt3: Evt = { v: 1, id: '3', session: 's', ts: 4, kind: 'evt', evt: 'step', payload: {} };

    queue.push(evt1);
    queue.push(evt2);
    queue.push(req1);
    expect(queue.size()).toBe(3);

    queue.push(evt3);
    expect(queue.size()).toBe(3);

    const items = [queue.pop(), queue.pop(), queue.pop()];
    expect(items[0]?.id).toBe('2');
    expect(items[1]?.id).toBe('r1');
    expect(items[2]?.id).toBe('3');
  });
});
