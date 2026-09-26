// AC-E2E-03: DOM interaction, mutation, find, click, type, and get_text
import { afterEach, describe, expect, it } from 'vitest';
import { type FixtureServer, startFixtureServer } from './fixtures';
import { type TetherHarness, launchTether } from './harness';
import { McpTestClient } from './helpers/mcp-client';
import { clickEnableInject } from './helpers/ui';

describe('Scenario: DOM Actions (AC-E2E-03)', () => {
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

  it('performs find, click, post-action snapshot confirmation, type and get_text on checkout-pay', async () => {
    fixtureServer = await startFixtureServer(4200);
    harness = await launchTether({ daemon: true });
    mcpClient = new McpTestClient(harness.httpPort);
    await mcpClient.connect();

    const page = await harness.ctx.newPage();
    await page.goto(`${fixtureServer.url}/checkout-pay`);
    await page.bringToFront();

    // Enable site access & inject content bridge
    await clickEnableInject(harness.ctx, harness.extensionId);

    // 1. browser_find the pay button
    const findPayRes = await mcpClient.call('browser_find', { query: 'pay' });
    expect(findPayRes.ok).toBe(true);
    const matches = (
      findPayRes.data as { matches: Array<{ ref: string; name: string; role: string }> }
    )?.matches;
    expect(matches && matches.length > 0).toBe(true);
    const payRef = matches[0]!.ref;

    // 2. browser_click the pay button ref
    const clickRes = await mcpClient.call('browser_click', { ref: payRef });
    expect(clickRes.ok).toBe(true);

    // 3. Post-action snapshot shows confirmation region
    const snapRes = await mcpClient.call('browser_snapshot', {});
    expect(snapRes.ok).toBe(true);
    const tree = (snapRes.data as { tree: string })?.tree ?? '';
    expect(tree.toLowerCase().includes('payment confirmed') || tree.includes('confirmation')).toBe(
      true,
    );

    // 4. browser_find text input field and type into it
    const findInputRes = await mcpClient.call('browser_find', { query: 'Card Number' });
    expect(findInputRes.ok).toBe(true);
    const inputMatches = (findInputRes.data as { matches: Array<{ ref: string; name: string }> })
      ?.matches;
    expect(inputMatches && inputMatches.length > 0).toBe(true);
    const inputRef = inputMatches[0]!.ref;

    const testValue = 'HelloTether';
    const typeRes = await mcpClient.call('browser_type', {
      ref: inputRef,
      text: testValue,
      clear: true,
    });
    console.log('DEBUG typeRes:', JSON.stringify(typeRes, null, 2));
    expect(typeRes.ok).toBe(true);

    // 5. browser_get_text returns typed value
    const textRes = await mcpClient.call('browser_get_text', { ref: inputRef });
    expect(textRes.ok).toBe(true);
    const text = (textRes.data as { text: string })?.text;
    expect(text).toBe(testValue);

    await page.close().catch(() => {});
  }, 60000);
});
