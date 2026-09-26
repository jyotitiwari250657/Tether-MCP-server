import type { ToolError } from '@tether/protocol';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { setupContentBridge } from '../lib/egress/index.js';
import { executeDomTool } from '../lib/session/dom-runner.js';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  registration: 'runtime',
  main() {
    console.log('[Tether] Content script injected into', window.location.href);
    setupContentBridge();

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (
        message &&
        typeof message === 'object' &&
        (message as { type?: string }).type === 'tether_ping'
      ) {
        sendResponse({ pong: true, url: window.location.href });
        return false;
      }
      if (
        message &&
        typeof message === 'object' &&
        (message as { type?: string }).type === 'tether_tool'
      ) {
        const { tool, args } = message as { tool: string; args: Record<string, unknown> };
        executeDomTool(tool, args)
          .then((result) => {
            sendResponse({ ok: true, result });
          })
          .catch((error) => {
            const errPayload: ToolError =
              typeof error === 'object' && error !== null && 'code' in error
                ? (error as ToolError)
                : {
                    code: 'INTERNAL',
                    message: error instanceof Error ? error.message : String(error),
                    retryable: false,
                  };
            sendResponse({ ok: false, error: errPayload });
          });
        return true;
      }
      const error: ToolError = {
        code: 'INTERNAL',
        message: 'Unknown content script message',
        retryable: false,
      };
      sendResponse({
        ok: false,
        error,
      });
      return false;
    });
  },
});
