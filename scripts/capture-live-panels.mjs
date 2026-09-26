#!/usr/bin/env node
/**
 * capture-live-panels.mjs — Prompt 16 live panel evidence capture.
 * Boots real daemon + Chrome harness with deviceScaleFactor 2, executes real MCP calls
 * via McpTestClient against static-1 and checkout-pay fixtures, then captures:
 * 1. docs/assets/sidepanel-live.png
 * 2. docs/assets/audit-verified.png
 * 3. docs/assets/approval-card.png
 */
import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { startFixtureServer } from '../tests/e2e/fixtures';
import { launchTether } from '../tests/e2e/harness';
import { McpTestClient } from '../tests/e2e/helpers/mcp-client';
import { clickEnableInject } from '../tests/e2e/helpers/ui';

if (process.argv.includes('--if-flag') && !process.argv.includes('--panels')) {
  process.exit(0);
}

const OUT_DIR = resolve(process.cwd(), 'docs', 'assets');
const SP_W = 400;
const SP_H = 620;

async function main() {
  console.log('[capture-live] Starting fixture server and harness...');
  const fixtureServer = await startFixtureServer(4862);
  const harness = await launchTether({ daemon: true, deviceScaleFactor: 2 });
  let mcpClient = null;

  try {
    const extId = harness.extensionId;
    mcpClient = new McpTestClient(harness.httpPort);
    await mcpClient.connect();

    // 1. Open target page static-1
    const targetPage = await harness.ctx.newPage();
    await targetPage.goto(`${fixtureServer.url}/static-1`);
    await targetPage.bringToFront();
    await clickEnableInject(harness.ctx, extId);

    // 2. Open side panel page
    const sp = await harness.ctx.newPage();
    await sp.setViewportSize({ width: SP_W, height: SP_H });
    await sp.goto(`chrome-extension://${extId}/sidepanel.html`);
    await sp.waitForLoadState('networkidle');

    // 3. Run browser_snapshot + browser_click on static-1
    await targetPage.bringToFront();
    const snapRes = await mcpClient.call('browser_snapshot', {});
    console.log('[capture-live] snapshot result:', snapRes.ok);

    let clickRef = 'A1';
    if (typeof snapRes.result?.snapshot === 'string') {
      const match = snapRes.result.snapshot.match(/\[([A-Z][0-9]+)\]/);
      if (match?.[1]) clickRef = match[1];
    }
    const clickRes = await mcpClient.call('browser_click', { ref: clickRef });
    console.log('[capture-live] click result:', clickRes.ok);

    // 4. Capture sidepanel-live.png
    await sp.bringToFront();
    await sp.waitForTimeout(600);
    await sp.waitForSelector('.font-semibold:has-text("browser_")', { timeout: 8000 });
    const sidepanelLivePath = join(OUT_DIR, 'sidepanel-live.png');
    await sp.screenshot({ path: sidepanelLivePath });
    console.log('[capture-live] wrote docs/assets/sidepanel-live.png');

    // 5. Audit tab + Verify -> capture audit-verified.png
    const auditTabBtn = sp.locator('nav button:has-text("audit")');
    await auditTabBtn.click();
    await sp.waitForTimeout(400);
    const verifyBtn = sp.locator('button:has-text("Verify")');
    await verifyBtn.click();
    await sp.waitForSelector('text=✓ Verified', { timeout: 8000 });
    await sp.waitForTimeout(400);
    const auditVerifiedPath = join(OUT_DIR, 'audit-verified.png');
    await sp.screenshot({ path: auditVerifiedPath });
    console.log('[capture-live] wrote docs/assets/audit-verified.png');

    // 6. Switch back to Session tab
    const sessionTabBtn = sp.locator('nav button:has-text("session")');
    await sessionTabBtn.click();
    await sp.waitForTimeout(300);

    // 7. Navigate target to checkout-pay & trigger T2 browser_submit
    await targetPage.bringToFront();
    await targetPage.goto(`${fixtureServer.url}/checkout-pay`);
    await targetPage.bringToFront();
    await clickEnableInject(harness.ctx, extId);

    const submitRes = await mcpClient.call('browser_submit', { ref: 'A1' });
    console.log('[capture-live] submit result code:', submitRes.error?.code);

    // 8. Capture approval-card.png, then click Deny
    await sp.bringToFront();
    await sp.waitForSelector('#approval-card', { timeout: 8000 });
    await sp.waitForTimeout(500);
    const approvalCardPath = join(OUT_DIR, 'approval-card.png');
    await sp.screenshot({ path: approvalCardPath });
    console.log('[capture-live] wrote docs/assets/approval-card.png');

    const denyBtn = sp.locator('#deny-button');
    await denyBtn.click();
    await sp.waitForTimeout(500);

    // 9. Assert file sizes (each between 20 KB and 900 KB)
    for (const [name, p] of [
      ['sidepanel-live.png', sidepanelLivePath],
      ['audit-verified.png', auditVerifiedPath],
      ['approval-card.png', approvalCardPath],
    ]) {
      const stats = statSync(p);
      const kb = stats.size / 1024;
      console.log(`[capture-live] ${name}: ${kb.toFixed(1)} KB`);
      if (stats.size <= 20 * 1024 || stats.size >= 900 * 1024) {
        throw new Error(`${name} size out of bounds: ${stats.size} bytes`);
      }
    }

    await targetPage.close().catch(() => {});
    await sp.close().catch(() => {});
  } finally {
    if (mcpClient) await mcpClient.close().catch(() => {});
    await harness.close().catch(() => {});
    await fixtureServer.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[capture-live] FAILED:', err);
  process.exit(1);
});
