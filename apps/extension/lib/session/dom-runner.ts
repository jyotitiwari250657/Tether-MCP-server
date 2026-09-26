/**
 * DOM Tool Execution Runner (TRD §6.4, §6.5, PRD FR-108).
 * Runs DOM actions and snapshots against document context (used by content script and local fallback).
 */

import type { ToolError } from '@tether/protocol';
import {
  type FillFormEntry,
  click,
  drag,
  extract,
  fillForm,
  hover,
  navigate,
  pressKey,
  scroll,
  select,
  submit,
  tabs,
  type,
  waitFor,
} from '../actions/index.js';
import { screenshot } from '../actions/screenshot.js';
import { resolve, snapshot } from '../refs/index.js';
import type { TransportClient } from '../transport/client.js';
import { debugLogger } from './debug-logger.js';

/**
 * Transport handle for daemon-side OCR (Prompt 11 §3). Set by the SW
 * bootstrap; a null value simply skips redaction (returns the raw capture).
 */
let ocrTransport: TransportClient | null = null;
export function setOcrTransport(t: TransportClient | null): void {
  ocrTransport = t;
}

export async function executeDomTool(
  toolName: string,
  reqArgs: Record<string, unknown>,
): Promise<unknown> {
  const h = async (ref: unknown) => {
    const refStr = typeof ref === 'string' ? ref : '';
    const r = await resolve(refStr);
    debugLogger.logRefResolution(refStr, r.ok ? r.handle.node : null, r.ok ? 'resolved' : 'failed');
    if (!r.ok) throw r.error;
    return r.handle;
  };

  switch (toolName) {
    case 'browser_snapshot': {
      const tabId = typeof reqArgs.tab === 'string' ? Number.parseInt(reqArgs.tab, 10) : 0;
      return snapshot(tabId, reqArgs);
    }
    case 'browser_find': {
      const snap = await snapshot(0, {});
      const q = typeof reqArgs.query === 'string' ? reqArgs.query.toLowerCase() : '';
      const limit = typeof reqArgs.limit === 'number' ? reqArgs.limit : 5;
      const matches = snap.nodes
        .filter((n) => n.name.toLowerCase().includes(q) || n.role.toLowerCase().includes(q))
        .slice(0, limit)
        .map((n) => ({ ref: n.ref, role: n.role, name: n.name }));
      return { matches };
    }
    case 'browser_click':
      return click(await h(reqArgs.ref), reqArgs);
    case 'browser_type':
      return type(await h(reqArgs.ref), {
        text: String(reqArgs.text ?? ''),
        clear: !!reqArgs.clear,
      });
    case 'browser_fill_form': {
      const fields = Array.isArray(reqArgs.fields) ? reqArgs.fields : [];
      return fillForm(fields as FillFormEntry[]);
    }
    case 'browser_extract':
      return extract({
        schema: (reqArgs.schema as Record<string, unknown>) ?? {},
      });
    case 'browser_get_text': {
      let el = (await h(reqArgs.ref)).node as HTMLElement;
      if (el.tagName === 'LABEL') {
        const label = el as HTMLLabelElement;
        if (label.htmlFor) {
          const byId = label.ownerDocument?.getElementById(label.htmlFor);
          if (byId) el = byId;
        } else if (
          label.nextElementSibling &&
          /INPUT|TEXTAREA/.test(label.nextElementSibling.tagName)
        ) {
          el = label.nextElementSibling as HTMLElement;
        } else {
          const nested = label.querySelector('input, textarea');
          if (nested) el = nested as HTMLElement;
        }
      }
      const val = (el as HTMLInputElement).value;
      const text = val !== undefined && val !== '' ? val : (el.innerText ?? el.textContent ?? '');
      return { text: String(text).trim(), trust: 'untrusted' };
    }
    case 'browser_navigate':
      return navigate({ url: String(reqArgs.url ?? ''), tab: reqArgs.tab as string | undefined });
    case 'browser_press_key':
      return pressKey(await h(reqArgs.ref), { key: String(reqArgs.key ?? '') });
    case 'browser_select':
    case 'browser_select_option':
      return select(await h(reqArgs.ref), reqArgs);
    case 'browser_scroll':
      return scroll(reqArgs);
    case 'browser_hover':
      return hover(await h(reqArgs.ref));
    case 'browser_drag':
      return drag(await h(reqArgs.from ?? reqArgs.fromRef), await h(reqArgs.to ?? reqArgs.toRef));
    case 'browser_wait':
    case 'browser_wait_for':
      return waitFor(reqArgs);
    case 'browser_submit':
      return submit(await h(reqArgs.ref), reqArgs);
    case 'browser_screenshot':
      return screenshot(
        {
          ref: typeof reqArgs.ref === 'string' ? reqArgs.ref : undefined,
          fullPage: !!reqArgs.fullPage,
          // Prompt 11: OCR redaction default-on (opts.ocrRedact !== false)
          ocrRedact: reqArgs.ocrRedact !== false,
          redactStyle: reqArgs.redactStyle === 'black' ? 'black' : 'blur',
        },
        ocrTransport,
      );
    case 'browser_tabs':
      return tabs(reqArgs as unknown as Parameters<typeof tabs>[0]);
    default:
      throw {
        code: 'INTERNAL',
        message: `Tool "${toolName}" is not implemented in this build`,
        hint: 'This tool is scheduled for subsequent development milestones',
        retryable: false,
      } as ToolError;
  }
}
