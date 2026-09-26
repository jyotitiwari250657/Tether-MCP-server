// AC-E2E-01: Daemon + Chrome + unpacked extension boot
import { afterEach, describe, expect, it } from 'vitest';
import { type TetherHarness, launchTether } from './harness';
import { readPopupStatus } from './helpers/ui';

describe('Scenario: Boot & Initial Connection (AC-E2E-01)', () => {
  let harness: TetherHarness | null = null;

  afterEach(async () => {
    if (harness) {
      await harness.close();
      harness = null;
    }
  });

  it('boots daemon and Chrome, popup renders Connected within 5s, and daemon health verifies extension socket', async () => {
    harness = await launchTether({ daemon: true });
    expect(harness.extensionId).toBeTruthy();
    expect(harness.httpPort).toBeGreaterThanOrEqual(18800); // dynamic port (AC-P12-02)

    // 1. Popup renders Connected within 5s
    const t0 = Date.now();
    let status = '';
    while (Date.now() - t0 < 5000) {
      status = await readPopupStatus(harness.ctx, harness.extensionId);
      if (status === 'Connected') break;
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(status).toBe('Connected');

    // 2. Query daemon health endpoint to verify active extension socket
    const res = await fetch(`http://127.0.0.1:${harness.httpPort}/readyz`);
    expect(res.ok).toBe(true);
    const health = (await res.json()) as { ready: boolean; extensionConnected: boolean };
    expect(health.extensionConnected).toBe(true);
  }, 60000);
});
