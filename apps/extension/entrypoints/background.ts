/**
 * Background Service Worker Router (PRD FR-101..FR-104, TRD §6.1, §6.2, §6.3).
 * Initializes session rehydration, connects transport client, routes all tools through
 * the session orchestrator, and maintains 10-minute idempotency caching.
 */

import type { Req, Res } from '@tether/protocol';
import { defineBackground } from 'wxt/utils/define-background';
import { bootstrap } from '../lib/boot/bootstrap.js';
import { EgressMonitor } from '../lib/egress/index.js';
import { grant as grantPolicy } from '../lib/policy/index.js';
import { setOcrTransport } from '../lib/session/dom-runner.js';
import { dispatch, rehydrate, setVaultClient } from '../lib/session/index.js';
import { TransportClient } from '../lib/transport/index.js';
import { VaultClient } from '../lib/vault/index.js';

interface CachedIdem {
  res: Res;
  expiresAt: number;
}

const IDEM_TTL_MS = 10 * 60 * 1000; // 10 minutes (AC-P05-19)
export const transport = new TransportClient();
export const vault = new VaultClient(transport);
export const egress = new EgressMonitor();
setVaultClient(vault);
setOcrTransport(transport); // Prompt 11 §3: daemon OCR for browser_screenshot
transport.setRequestHandler((req) => handleToolRequest(req));

export async function handleToolRequest(req: Req): Promise<Res> {
  const { id, idem } = req;

  // 1. Check idempotency cache (AC-P05-19)
  if (idem && typeof chrome !== 'undefined' && chrome.storage?.session) {
    const key = `idem:${idem}`;
    const stored = await chrome.storage.session.get(key);
    const cached = stored[key] as CachedIdem | undefined;
    if (cached && Date.now() < cached.expiresAt) {
      return {
        ...cached.res,
        id, // return with current request id
      };
    }
  }

  // 2. Dispatch tool via Session Orchestrator (P06: routes all 40 tools)
  const response = await dispatch(req);

  // 3. Emit step event to side panel (FR-702); Prompt 11 §4 adds OCR status
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      const result =
        response.ok && typeof response === 'object' && 'result' in response
          ? (response.result as Record<string, unknown> | undefined)
          : undefined;
      chrome.runtime.sendMessage({
        kind: 'evt',
        evt: 'step',
        payload: {
          id: req.id,
          tool: req.tool,
          ok: response.ok,
          ms: response.ms,
          ts: Date.now(),
          ocrDegraded: result?.ocrDegraded === true,
          ocrHits: typeof result?.ocrRedactionHits === 'number' ? result.ocrRedactionHits : 0,
        },
      });
    } catch {
      // Side panel might not be open; ignore error
    }
  }

  // 4. Store in idempotency cache if idem provided
  if (idem && typeof chrome !== 'undefined' && chrome.storage?.session) {
    const key = `idem:${idem}`;
    const cacheEntry: CachedIdem = {
      res: response,
      expiresAt: Date.now() + IDEM_TTL_MS,
    };
    await chrome.storage.session.set({ [key]: cacheEntry });
  }

  return response;
}

export default defineBackground(() => {
  console.log('[Tether] Service worker initializing');

  // Rehydrate SW state from storage (PRD FR-108)
  rehydrate().catch((err) => {
    console.error('[Tether] State rehydration error:', err);
  });

  // Attempt connection to daemon loopback via bootstrap handshake
  bootstrap(transport).catch((err) => {
    console.error('[Tether] Bootstrap error:', err);
  });

  // Reconnect-on-wake triggers (Prompt 09-FIX-01)
  if (typeof chrome !== 'undefined') {
    chrome.runtime?.onStartup?.addListener(() => {
      void transport.ensureConnected();
    });

    chrome.runtime?.onInstalled?.addListener(() => {
      void transport.ensureConnected();
    });

    chrome.runtime?.onConnect?.addListener(() => {
      void transport.ensureConnected();
    });

    chrome.alarms?.onAlarm?.addListener((alarm) => {
      if (alarm.name === 'tether-reconnect') {
        void transport.ensureConnected();
      }
    });
  }

  let firstMessagePerWake = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (firstMessagePerWake) {
      firstMessagePerWake = false;
      void transport.ensureConnected();
    }

    if (message && typeof message === 'object') {
      const msg = message as Record<string, unknown>;

      if (msg.type === 'get_transport_status') {
        sendResponse({ state: transport.state });
        return false;
      }

      if (msg.type === 'kill_switch') {
        transport.close('user_kill_switch');
        sendResponse({ ok: true });
        return false;
      }

      // Prompt 12 AC-P12-01 (HR-10): the ONLY way a killed daemon is re-armed
      // is this explicit user-gesture message from the popup. It must reach the
      // daemon as {type:'reset_kill_switch'}; it never fires on reconnect.
      if (msg.type === 'reset_kill_switch') {
        void transport
          .ensureConnected()
          .then(() => {
            const sent = transport.sendControl({ type: 'reset_kill_switch' });
            sendResponse({ ok: sent });
          })
          .catch(() => {
            sendResponse({ ok: false, error: 'Daemon unreachable' });
          });
        return true;
      }

      if (msg.type === 'enable_site_access') {
        void transport.ensureConnected();
        const urlStr = typeof msg.url === 'string' ? msg.url : '';
        let domain = '<all>';
        try {
          if (urlStr) domain = new URL(urlStr).hostname;
        } catch {}
        grantPolicy({
          id: `rule-grant-${Date.now()}`,
          match: { kind: domain === '<all>' ? 'all' : 'exact', value: domain },
          level: 'WRITE',
          scope: 'session',
          actor: 'user',
          createdAt: Date.now(),
        })
          .then(() => {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
              chrome.tabs
                .query({})
                .then((tabs) => {
                  for (const tab of tabs) {
                    if (tab.id) {
                      chrome.scripting
                        .executeScript({
                          target: { tabId: tab.id },
                          files: ['content-scripts/content.js'],
                        })
                        .catch(() => {});
                    }
                  }
                })
                .catch(() => {});
            }
            sendResponse({ ok: true });
          })
          .catch((err) => {
            sendResponse({ ok: false, error: String(err) });
          });
        return true;
      }

      if (msg.kind === 'evt' && msg.evt === 'egress.observe') {
        const outcome = egress.observe(msg.payload as Parameters<typeof egress.observe>[0]);
        if (!outcome.allowed) {
          chrome.runtime
            .sendMessage({
              kind: 'evt',
              evt: 'egress.blocked',
              payload: { ...(msg.payload as object), reason: outcome.reason },
            })
            .catch(() => {});
        }
        return false;
      }

      if ('tool' in msg && 'id' in msg) {
        handleToolRequest(message as Req)
          .then(sendResponse)
          .catch((err) => {
            sendResponse({
              v: 1,
              id: (msg.id as string) || 'unknown',
              session: (msg.session as string) || 'default',
              ts: Date.now(),
              kind: 'res',
              reqId: (msg.id as string) || 'unknown',
              ok: false,
              error: {
                code: 'INTERNAL',
                message: err instanceof Error ? err.message : 'Message handling failed',
                hint: 'Internal error in message handler',
                retryable: false,
              },
              ms: 1,
            });
          });
        return true; // Keep channel open for async response
      }
    }
    return false;
  });
});
