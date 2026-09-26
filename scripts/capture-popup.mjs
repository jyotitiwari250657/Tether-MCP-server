#!/usr/bin/env node
/**
 * capture-popup.mjs — Prompt 14-FIX-01, AC-F14-05.
 * Boots the e2e harness (real daemon + real Chrome), opens the extension popup
 * at 360x520 and the side panel at 480x640, and screenshots both to
 * docs/assets/{popup,sidepanel}-current.png for the report's visual evidence.
 */
import { join, resolve } from 'node:path';
import { startFixtureServer } from '../tests/e2e/fixtures';
import { launchTether } from '../tests/e2e/harness';

const W = 360;
const H = 520;
const SP_W = 480;
const SP_H = 640;
const OUT_DIR = resolve(process.cwd(), 'docs', 'assets');

async function main() {
  const fixtureServer = await startFixtureServer(4851);
  const harness = await launchTether({ daemon: true });
  try {
    const extId = harness.extensionId;

    // Popup
    const popup = await harness.ctx.newPage();
    await popup.setViewportSize({ width: W, height: H });
    await popup.goto(`chrome-extension://${extId}/popup.html`);
    await popup.waitForLoadState('networkidle');
    await popup.waitForTimeout(400); // settle status dot query
    await popup.screenshot({ path: join(OUT_DIR, 'popup-current.png') });
    console.log(`wrote docs/assets/popup-current.png (${W}x${H})`);
    await popup.close();

    // Side panel
    const sp = await harness.ctx.newPage();
    await sp.setViewportSize({ width: SP_W, height: SP_H });
    await sp.goto(`chrome-extension://${extId}/sidepanel.html`);
    await sp.waitForLoadState('networkidle');
    await sp.waitForTimeout(400);
    await sp.screenshot({ path: join(OUT_DIR, 'sidepanel-current.png') });
    console.log(`wrote docs/assets/sidepanel-current.png (${SP_W}x${SP_H})`);
    await sp.close();
  } finally {
    await harness.close().catch(() => {});
    await fixtureServer.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('capture failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
