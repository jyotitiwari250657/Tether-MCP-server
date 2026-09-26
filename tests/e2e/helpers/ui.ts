// TRD §12, AC-E2E-01..06: Extension UI helpers for Playwright tests
import type { BrowserContext, Page } from 'playwright';

export async function getExtensionId(ctx: BrowserContext): Promise<string> {
  let workers = ctx.serviceWorkers();
  if (workers.length === 0) {
    try {
      const sw = await ctx.waitForEvent('serviceworker', { timeout: 7000 });
      if (sw) workers = [sw];
    } catch {}
  }
  for (const sw of workers) {
    const match = sw.url().match(/chrome-extension:\/\/([^/]+)/);
    if (match?.[1]) return match[1];
  }
  for (const page of ctx.pages()) {
    const match = page.url().match(/chrome-extension:\/\/([^/]+)/);
    if (match?.[1]) return match[1];
  }
  throw new Error('Extension ID could not be detected from service worker or pages');
}

export async function openPopup(ctx: BrowserContext, extId?: string): Promise<Page> {
  const id = extId || (await getExtensionId(ctx));
  const page = await ctx.newPage();
  page.on('console', (msg) => console.log('POPUP CONSOLE:', msg.text()));
  page.on('pageerror', (err) => console.log('POPUP ERROR:', err.message));
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.waitForLoadState('domcontentloaded');
  return page;
}

export async function readPopupStatus(ctx: BrowserContext, extId?: string): Promise<string> {
  const page = await openPopup(ctx, extId);
  try {
    const statusElem = page.locator('span:has(span.rounded-full)');
    await statusElem.waitFor({ timeout: 5000 });
    return (await statusElem.textContent())?.trim() ?? '';
  } finally {
    await page.close().catch(() => {});
  }
}

export async function clickEnableInject(ctx: BrowserContext, extId?: string): Promise<void> {
  const page = await openPopup(ctx, extId);
  try {
    const btn = page.locator('button:has-text("Enable Site Access & Inject")');
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(600);
  } finally {
    await page.close().catch(() => {});
  }
}

export async function clickKillSwitch(ctx: BrowserContext, extId?: string): Promise<void> {
  const page = await openPopup(ctx, extId);
  try {
    const btn = page.locator('button:has-text("Kill Switch")').first();
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(300);
  } finally {
    await page.close().catch(() => {});
  }
}

// Prompt 12 (AC-P12-01): explicit user-gesture reset of the sticky kill switch.
// Mirrors the popup "⟳ Reset Kill Switch" button that sends {type:'reset_kill_switch'}
// to the daemon via transport.sendControl. HR-10: the flag is no longer cleared on hello.
export async function clickResetKillSwitch(ctx: BrowserContext, extId?: string): Promise<void> {
  const page = await openPopup(ctx, extId);
  try {
    const btn = page.locator('button:has-text("Reset Kill Switch")');
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(400);
  } finally {
    await page.close().catch(() => {});
  }
}

export async function openSidePanel(ctx: BrowserContext, extId?: string): Promise<Page> {
  const id = extId || (await getExtensionId(ctx));
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/sidepanel.html`);
  await page.waitForLoadState('domcontentloaded');
  return page;
}
