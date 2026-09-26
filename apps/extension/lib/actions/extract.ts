/**
 * Structured Data Extraction Action (PRD §10.2, TRD §5.4, TOOL-R08).
 * Recursively extracts structured data from the DOM adhering to a JSON Schema.
 */

import type { ToolError } from '@tether/protocol';
import { debugLogger } from '../session/debug-logger.js';

export interface ExtractOpts {
  schema: Record<string, unknown>;
  root?: Element | null | undefined;
  timeoutMs?: number | undefined;
}

const VALID_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean']);

function validateJsonSchema(schema: unknown, path = '$'): void {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw {
      code: 'SCHEMA_INVALID',
      message: `Invalid schema at ${path}: schema must be an object.`,
      hint: 'Provide a valid JSON Schema definition.',
      retryable: false,
    } as ToolError;
  }

  const s = schema as Record<string, unknown>;
  if (s.type !== undefined) {
    if (typeof s.type !== 'string' || !VALID_TYPES.has(s.type)) {
      throw {
        code: 'SCHEMA_INVALID',
        message: `Invalid type "${String(s.type)}" at ${path}. Supported types: ${Array.from(VALID_TYPES).join(', ')}`,
        hint: 'Use a standard JSON Schema type.',
        retryable: false,
      } as ToolError;
    }
  }

  if (s.properties && typeof s.properties === 'object') {
    for (const [key, prop] of Object.entries(s.properties as Record<string, unknown>)) {
      validateJsonSchema(prop, `${path}.properties.${key}`);
    }
  }

  if (s.items) {
    validateJsonSchema(s.items, `${path}.items`);
  }
}

function extractPrimitive(el: Element, type: string): unknown {
  const isInput = /INPUT|TEXTAREA|SELECT/i.test(el.tagName);
  const val = isInput ? (el as HTMLInputElement).value : undefined;
  const rawText = val !== undefined && val !== '' ? val : (el.textContent ?? '').trim();

  if (type === 'number' || type === 'integer') {
    const num = Number.parseFloat(rawText.replace(/[^0-9.-]/g, ''));
    return Number.isNaN(num) ? 0 : type === 'integer' ? Math.round(num) : num;
  }

  if (type === 'boolean') {
    if ((el as HTMLInputElement).checked !== undefined) return (el as HTMLInputElement).checked;
    return /true|yes|1|on/i.test(rawText);
  }

  return rawText;
}

function findElementsForProp(root: Element, key: string): Element[] {
  const k = key.toLowerCase();
  const selectors = [
    `#${k}`,
    `[name="${k}"]`,
    `[data-testid="${k}"]`,
    `[aria-label*="${k}" i]`,
    `.${k}`,
    `[id*="${k}"]`,
    `[class*="${k}"]`,
  ];

  for (const sel of selectors) {
    try {
      const found = Array.from(root.querySelectorAll(sel));
      if (found.length > 0) return found;
    } catch {}
  }

  return [];
}

function extractNode(el: Element, schema: Record<string, unknown>, deadline: number): unknown {
  if (Date.now() > deadline) {
    throw {
      code: 'TIMEOUT',
      message: 'Extraction exceeded timeout limit.',
      hint: 'Simplify the schema or narrow extraction scope.',
      retryable: true,
    } as ToolError;
  }

  const type = (typeof schema.type === 'string' ? schema.type : 'object').toLowerCase();

  if (type === 'string' || type === 'number' || type === 'integer' || type === 'boolean') {
    return extractPrimitive(el, type);
  }

  if (type === 'array') {
    const itemSchema = (schema.items as Record<string, unknown>) ?? { type: 'string' };
    const candidates = el.querySelectorAll(
      'tr, li, article, .item, .card, .row, .post, [role="row"], [role="listitem"]',
    );
    const elements = candidates.length > 0 ? Array.from(candidates) : Array.from(el.children);
    return elements.map((child) => extractNode(child, itemSchema, deadline));
  }

  if (type === 'object') {
    const result: Record<string, unknown> = {};
    const props = (schema.properties as Record<string, unknown>) ?? {};

    for (const [propName, propSchema] of Object.entries(props)) {
      const subSchema = (propSchema as Record<string, unknown>) ?? { type: 'string' };
      const targets = findElementsForProp(el, propName);
      if (targets.length > 0 && targets[0]) {
        result[propName] = extractNode(targets[0], subSchema, deadline);
      } else {
        result[propName] = extractNode(el, subSchema, deadline);
      }
    }

    return result;
  }

  return el.textContent?.trim() ?? '';
}

export async function extract(opts: ExtractOpts): Promise<{ data: unknown; trust: 'untrusted' }> {
  const timeoutMs = opts.timeoutMs ?? 10000;
  const deadline = Date.now() + timeoutMs;

  validateJsonSchema(opts.schema);

  const doc = globalThis.document;
  const root = opts.root ?? doc?.body ?? doc?.documentElement;

  if (!root) {
    throw {
      code: 'INTERNAL',
      message: 'Document root unavailable for extraction.',
      hint: 'Ensure document is loaded before extracting.',
      retryable: false,
    } as ToolError;
  }

  debugLogger.logDomOperation('extract', root, { schema: opts.schema });

  const data = extractNode(root, opts.schema, deadline);
  return { data, trust: 'untrusted' };
}
