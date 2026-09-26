// AC-E2E-04, AC-E2E-05: Policy enforcement, sensitive domain refusal, and T2 confirmation diffs
import { afterEach, describe, expect, it } from 'vitest';
import { type FixtureServer, startFixtureServer } from './fixtures';
import { type TetherHarness, launchTether } from './harness';
import { McpTestClient } from './helpers/mcp-client';
import { clickEnableInject } from './helpers/ui';

describe('Scenario: Policy Enforcement (AC-E2E-04, AC-E2E-05)', () => {
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

  it('AC-E2E-04: denies access to sensitive banking domain in < 2s with POLICY_DENIED and no injection', async () => {
    fixtureServer = await startFixtureServer(4300);
    harness = await launchTether({ daemon: true });
    mcpClient = new McpTestClient(harness.httpPort);
    await mcpClient.connect();

    const page = await harness.ctx.newPage();
    await page.goto(`${fixtureServer.url}/login-bank`);
    await page.bringToFront();

    const start = Date.now();
    const res = await mcpClient.call('browser_snapshot', {});
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('POLICY_DENIED');

    await page.close().catch(() => {});
  }, 60000);

  it('AC-E2E-05: requires explicit user confirmation with >= 3 diff rows on T2 submit', async () => {
    fixtureServer = await startFixtureServer(4301);
    harness = await launchTether({ daemon: true });
    mcpClient = new McpTestClient(harness.httpPort);
    await mcpClient.connect();

    const page = await harness.ctx.newPage();
    await page.goto(`${fixtureServer.url}/checkout-pay`);
    await page.bringToFront();

    await clickEnableInject(harness.ctx, harness.extensionId);

    // Call T2 action browser_submit without confirmToken
    const submitRes = await mcpClient.call('browser_submit', { ref: 'A1' });
    expect(submitRes.ok).toBe(false);
    expect(submitRes.error?.code).toBe('NEEDS_CONFIRMATION');

    // Assert that >= 3 diff rows are presented
    const details = submitRes.error?.details as
      | { diff?: Array<{ label: string; value: string }> }
      | undefined;
    const diff =
      (submitRes.error?.diff as Array<{ label: string; value: string }> | undefined) ??
      details?.diff;
    expect(Array.isArray(diff)).toBe(true);
    expect(diff!.length).toBeGreaterThanOrEqual(3);

    await page.close().catch(() => {});
  }, 60000);
});
