/**
 * Main-World Network Instrumentation (PRD FR-511, TRD §6.8).
 * Wraps fetch, XHR, sendBeacon, and WebSocket to notify isolated world of script-driven network traffic.
 */

import type { EgressPostMessage } from './types.js';

export function resetNetworkInstrumentation(): void {
  if (typeof window !== 'undefined') {
    const win = window as unknown as { __tether_instrumented?: boolean };
    win.__tether_instrumented = false;
  }
}

export function installNetworkInstrumentation(): void {
  // Graceful degradation check (user constraint)
  if (typeof window === 'undefined' || typeof window.postMessage !== 'function') {
    return;
  }

  // Prevent double instrumentation
  const win = window as unknown as { __tether_instrumented?: boolean };
  if (win.__tether_instrumented) {
    return;
  }
  win.__tether_instrumented = true;

  function emitEgress(origin: string, method: string, bytes: number): void {
    try {
      const msg: EgressPostMessage = {
        __tether: 1,
        type: 'egress',
        payload: {
          origin,
          method,
          bytes,
          initiator: 'script',
        },
      };
      window.postMessage(msg, '*');
    } catch {
      // Degrade silently on postMessage error
    }
  }

  function extractOrigin(url: string | URL): string {
    try {
      const u = typeof url === 'string' ? new URL(url, window.location.href) : url;
      return `${u.protocol}//${u.host}`;
    } catch {
      return window.location.origin;
    }
  }

  // 1. Wrap window.fetch
  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch;
    window.fetch = function tetherFetch(
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      try {
        const url = typeof input === 'string' || input instanceof URL ? input : input.url;
        const method =
          init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET');
        let bytes = 0;

        if (init?.body) {
          if (typeof init.body === 'string') bytes = init.body.length;
          else if (init.body instanceof Blob) bytes = init.body.size;
          else if (init.body instanceof ArrayBuffer) bytes = init.body.byteLength;
        }

        emitEgress(extractOrigin(url), method, bytes);
      } catch {
        // Silently continue to original fetch
      }
      return originalFetch.apply(this, [input, init]);
    };
  }

  // 2. Wrap XMLHttpRequest
  if (typeof XMLHttpRequest !== 'undefined') {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function tetherXhrOpen(
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ): void {
      (this as unknown as { __tether_url?: string; __tether_method?: string }).__tether_url =
        String(url);
      (this as unknown as { __tether_method?: string }).__tether_method = method;
      return origOpen.apply(this, [
        method,
        url,
        ...(rest as [boolean, (string | null | undefined)?, (string | null | undefined)?]),
      ]);
    };

    XMLHttpRequest.prototype.send = function tetherXhrSend(
      body?: Document | XMLHttpRequestBodyInit | null,
    ): void {
      try {
        const url = (this as unknown as { __tether_url?: string }).__tether_url ?? '';
        const method = (this as unknown as { __tether_method?: string }).__tether_method ?? 'GET';
        let bytes = 0;
        if (typeof body === 'string') bytes = body.length;
        else if (body instanceof Blob) bytes = body.size;
        else if (body instanceof ArrayBuffer) bytes = body.byteLength;

        emitEgress(extractOrigin(url), method, bytes);
      } catch {
        // Silently continue
      }
      return origSend.apply(this, [body]);
    };
  }

  // 3. Wrap navigator.sendBeacon
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const origBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function tetherSendBeacon(
      url: string | URL,
      data?: BodyInit | null,
    ): boolean {
      try {
        let bytes = 0;
        if (typeof data === 'string') bytes = data.length;
        else if (data instanceof Blob) bytes = data.size;
        else if (data instanceof ArrayBuffer) bytes = data.byteLength;

        emitEgress(extractOrigin(url), 'POST', bytes);
      } catch {
        // Silently continue
      }
      return origBeacon.apply(this, [url, data]);
    };
  }
}
