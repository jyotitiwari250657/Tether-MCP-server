/**
 * Egress Content Script Bridge (PRD FR-511, TRD §6.8).
 * Bridges main-world egress notifications and PerformanceObserver resource events to the Service Worker.
 */

import type { EgressObservation, EgressPostMessage } from './types.js';

export function setupContentBridge(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleMessage = (event: MessageEvent): void => {
    const data = event.data as Partial<EgressPostMessage> | null;
    if (data && data.__tether === 1 && data.type === 'egress' && data.payload) {
      const chromeApi =
        typeof chrome !== 'undefined'
          ? chrome
          : (window as unknown as { chrome?: typeof chrome })?.chrome;
      if (chromeApi?.runtime?.sendMessage) {
        try {
          chromeApi.runtime.sendMessage({
            kind: 'evt',
            evt: 'egress.observe',
            payload: data.payload,
          });
        } catch {
          // SW might be inactive or reloading
        }
      }
    }
  };

  window.addEventListener('message', handleMessage);

  // PerformanceObserver for sub-resource loads (images, styles, fonts)
  let perfObserver: PerformanceObserver | null = null;
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      perfObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          try {
            const u = new URL(entry.name);
            const obs: EgressObservation = {
              origin: `${u.protocol}//${u.host}`,
              method: 'GET',
              bytes: (entry as PerformanceResourceTiming).transferSize ?? 0,
              initiator: 'other',
            };
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
              chrome.runtime.sendMessage({
                kind: 'evt',
                evt: 'egress.observe',
                payload: obs,
              });
            }
          } catch {
            // Ignore non-URL entries
          }
        }
      });
      perfObserver.observe({ type: 'resource', buffered: true });
    } catch {
      // Ignore if PerformanceObserver resource type is unsupported
    }
  }

  return () => {
    window.removeEventListener('message', handleMessage);
    if (perfObserver) {
      perfObserver.disconnect();
      perfObserver = null;
    }
  };
}
