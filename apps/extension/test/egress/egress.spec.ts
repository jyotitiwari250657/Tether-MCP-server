// @vitest-environment happy-dom
/**
 * Egress Monitor Unit Tests (PRD FR-511, TRD §6.8, ADR-005).
 * Verifies baseline snapshots, novel origin detection, instrumentation wrapping, and event bridging.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { setupContentBridge } from '../../lib/egress/content-bridge.js';
import {
  installNetworkInstrumentation,
  resetNetworkInstrumentation,
} from '../../lib/egress/instrument.js';
import { EgressMonitor } from '../../lib/egress/monitor.js';

describe('Egress Monitor (PRD FR-511, TRD §6.8)', () => {
  let monitor: EgressMonitor;

  beforeEach(() => {
    monitor = new EgressMonitor();
  });

  // 1. Baseline allowance
  test('FR-511: allows requests to origins established in session baseline', () => {
    monitor.beginSession(['https://trusted.example.com', 'https://api.trusted.com']);

    const res1 = monitor.observe({
      origin: 'https://trusted.example.com',
      method: 'POST',
      bytes: 1024,
      initiator: 'script',
    });
    expect(res1.allowed).toBe(true);

    const res2 = monitor.observe({
      origin: 'https://api.trusted.com',
      method: 'GET',
      bytes: 0,
      initiator: 'script',
    });
    expect(res2.allowed).toBe(true);

    expect(monitor.blocked.length).toBe(0);
  });

  // 2. Flags novel origin with script data egress
  test('FR-511: flags and records novel origin when script egresses bytes > 0', () => {
    monitor.beginSession(['https://trusted.example.com']);

    let blockedCallbackFired = false;
    monitor.onBlocked((b) => {
      blockedCallbackFired = true;
      expect(b.origin).toBe('https://exfiltration.attacker.com');
    });

    const res = monitor.observe({
      origin: 'https://exfiltration.attacker.com',
      method: 'POST',
      bytes: 512,
      initiator: 'script',
    });

    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('novel_origin_script_egress');
    expect(blockedCallbackFired).toBe(true);
    expect(monitor.blocked.length).toBe(1);
    expect(monitor.blocked[0]?.origin).toBe('https://exfiltration.attacker.com');
  });

  // 3. Allows non-script or zero-byte traffic to novel origins
  test('FR-511: allows non-script image/font assets or zero-byte GETs to novel origins', () => {
    monitor.beginSession(['https://trusted.example.com']);

    // Non-script image asset
    const res1 = monitor.observe({
      origin: 'https://cdn.thirdparty.com',
      method: 'GET',
      bytes: 2048,
      initiator: 'other',
    });
    expect(res1.allowed).toBe(true);

    // Zero-byte script ping
    const res2 = monitor.observe({
      origin: 'https://ping.thirdparty.com',
      method: 'GET',
      bytes: 0,
      initiator: 'script',
    });
    expect(res2.allowed).toBe(true);
    expect(monitor.blocked.length).toBe(0);
  });

  // 4. Report structure
  test('FR-511: report aggregates allowed and blocked sets', () => {
    monitor.beginSession(['https://trusted.com']);
    monitor.observe({
      origin: 'https://trusted.com',
      method: 'GET',
      bytes: 100,
      initiator: 'script',
    });
    monitor.observe({ origin: 'https://evil.com', method: 'POST', bytes: 50, initiator: 'script' });

    const rep = monitor.report();
    expect(rep.allowed).toContain('https://trusted.com');
    expect(rep.blocked.length).toBe(1);
    expect(rep.blocked[0]?.origin).toBe('https://evil.com');
  });

  // 5. Reset clears state
  test('FR-511: reset clears baseline, allowed, and blocked sets', () => {
    monitor.beginSession(['https://a.com']);
    monitor.observe({ origin: 'https://bad.com', method: 'POST', bytes: 10, initiator: 'script' });
    expect(monitor.blocked.length).toBe(1);

    monitor.reset();
    expect(monitor.baseline.size).toBe(0);
    expect(monitor.allowed.size).toBe(0);
    expect(monitor.blocked.length).toBe(0);
  });

  // 6. Network instrumentation and content bridge
  test('FR-511: network instrumentation wraps fetch and posts message to content bridge', async () => {
    resetNetworkInstrumentation();
    const mockChrome = {
      runtime: {
        sendMessage: vi.fn((msg: unknown) => {
          messages.push(msg);
        }),
      },
    };
    (globalThis as unknown as { chrome: unknown }).chrome = mockChrome;
    (window as unknown as { chrome: unknown }).chrome = mockChrome;

    window.fetch = vi.fn().mockResolvedValue(new Response('ok'));
    installNetworkInstrumentation();
    const cleanup = setupContentBridge();

    try {
      // Simulate fetch
      await window.fetch('https://api.external.com/data', {
        method: 'POST',
        body: 'sample data',
      });

      // Allow microtask / postMessage propagation
      await new Promise((r) => setTimeout(r, 20));

      expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });

  test('FR-511: network instrumentation wraps XMLHttpRequest, sendBeacon, and WebSocket', async () => {
    resetNetworkInstrumentation();
    const sent: unknown[] = [];
    (window as unknown as { chrome: unknown }).chrome = {
      runtime: {
        sendMessage: vi.fn((msg: unknown) => {
          sent.push(msg);
        }),
      },
    };

    // Mock underlying transports to prevent real network I/O
    const origXhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = vi.fn();
    navigator.sendBeacon = vi.fn().mockReturnValue(true);
    class MockWs {
      constructor(public url: string) {}
      close() {}
    }
    (window as unknown as { WebSocket: unknown }).WebSocket = MockWs;

    installNetworkInstrumentation();
    const cleanup = setupContentBridge();

    try {
      // 1. XHR test
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://api.xhr.example/submit');
      xhr.send('xhr-payload');

      // 2. sendBeacon test
      navigator.sendBeacon('https://api.beacon.example/log', 'beacon-payload');

      // 3. WebSocket test
      const ws = new (
        window as unknown as { WebSocket: new (u: string) => { close: () => void } }
      ).WebSocket('wss://socket.example/live');
      ws.close();

      await new Promise((r) => setTimeout(r, 20));
      expect(sent.length).toBeGreaterThan(0);
    } finally {
      XMLHttpRequest.prototype.send = origXhrSend;
      cleanup();
    }
  });
});
