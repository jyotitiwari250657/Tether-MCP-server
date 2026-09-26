// AC-E2E-06, HR-10: Immediate abort on kill switch engagement
import { afterEach, describe, expect, it } from 'vitest';
import { type FixtureServer, startFixtureServer } from './fixtures';
import { type TetherHarness, launchTether } from './harness';
import { McpTestClient } from './helpers/mcp-client';
import { clickEnableInject, clickKillSwitch, readPopupStatus } from './helpers/ui';

describe('Scenario: Kill Switch Engagement (AC-E2E-06)', () => {
  let harness: TetherHarness | null = null;
  let fixtureServer: FixtureServer | null = null;
  let mcpClient: McpTestClient | null = null;

  afterEach(async () => {
    if (mcpClient) {
      await mcpClient.close().catch(() => {});
      mcpClient = null;
    }
    if (harness) {
      await harness.close();
      harness = null;
    }
    if (fixtureServer) {
      await fixtureServer.close().catch(() => {});
      fixtureServer = null;
    }
  });

  it('engages kill switch from popup, aborts subsequent tool call within 2s with SESSION_ABORTED, and reflects aborted state in popup', async () => {
    fixtureServer = await startFixtureServer(4400);
    harness = await launchTether({ daemon: true });
    mcpClient = new McpTestClient(harness.httpPort);
    await mcpClient.connect();

    const page = await harness.ctx.newPage();
    await page.goto(`${fixtureServer.url}/static-1`);
    await page.bringToFront();

    await clickEnableInject(harness.ctx, harness.extensionId);

    // Initial snapshot succeeds
    const initialRes = await mcpClient.call('browser_snapshot', {});
    expect(initialRes.ok).toBe(true);

    // Engage kill switch from popup
    await clickKillSwitch(harness.ctx, harness.extensionId);

    // Verify popup status reflects disconnected / aborted state
    const status = await readPopupStatus(harness.ctx, harness.extensionId);
    const lowerStatus = status.toLowerCase();
    expect(
      lowerStatus.includes('aborted') ||
        lowerStatus.includes('disconnected') ||
        lowerStatus.includes('not connected') ||
        lowerStatus.includes('closed'),
    ).toBe(true);

    // Subsequent tool call must return SESSION_ABORTED in < 2s
    const start = Date.now();
    const abortedRes = await mcpClient.call('browser_snapshot', {});
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
    expect(abortedRes.ok).toBe(false);
    expect(abortedRes.error?.code).toBe('SESSION_ABORTED');

    await page.close().catch(() => {});
  }, 60000);
});
