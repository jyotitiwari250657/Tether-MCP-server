// @vitest-environment happy-dom
/**
 * Structured Data Extraction Tests (PRD §10.2, TRD §5.4, TOOL-R08).
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { extract } from '../../lib/actions/extract.js';

describe('Action Executor — Extract (TOOL-R08, PRD §10.2)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // 1. Simple schema extraction
  test('TOOL-R08: extract with a simple schema extracts fields correctly', async () => {
    document.body.innerHTML = `
      <div id="product">
        <h1 id="title">Wireless Headphones</h1>
        <span id="price">$99.99</span>
        <span id="inStock">true</span>
      </div>
    `;

    const res = await extract({
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          price: { type: 'number' },
          inStock: { type: 'boolean' },
        },
      },
    });

    expect(res.trust).toBe('untrusted');
    expect(res.data).toEqual({
      title: 'Wireless Headphones',
      price: 99.99,
      inStock: true,
    });
  });

  // 2. Nested schema extraction
  test('TOOL-R08: extract with a nested schema extracts nested structure', async () => {
    document.body.innerHTML = `
      <div id="author-card">
        <div id="author">
          <span id="name">Ada Lovelace</span>
          <span id="role">Mathematician</span>
        </div>
        <ul id="publications">
          <li class="item">Notes on the Analytical Engine</li>
          <li class="item">Sketch of the Analytical Engine</li>
        </ul>
      </div>
    `;

    const res = await extract({
      schema: {
        type: 'object',
        properties: {
          author: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              role: { type: 'string' },
            },
          },
          publications: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    });

    expect(res.trust).toBe('untrusted');
    const data = res.data as {
      author: { name: string; role: string };
      publications: string[];
    };
    expect(data.author.name).toBe('Ada Lovelace');
    expect(data.author.role).toBe('Mathematician');
    expect(data.publications).toContain('Notes on the Analytical Engine');
  });

  // 3. Extraction timeout returns structured error
  test('TOOL-R08: extract timeout returns structured TIMEOUT error', async () => {
    document.body.innerHTML = '<div>Content</div>';

    await expect(
      extract({
        schema: { type: 'object' },
        timeoutMs: -1,
      }),
    ).rejects.toMatchObject({
      code: 'TIMEOUT',
      hint: expect.stringContaining('scope'),
      retryable: true,
    });
  });

  // 4. Invalid schema rejection
  test('TOOL-R08: extract rejects invalid schema with SCHEMA_INVALID', async () => {
    await expect(
      extract({
        schema: { type: 'unsupported_type' },
      }),
    ).rejects.toMatchObject({
      code: 'SCHEMA_INVALID',
    });
  });
});
