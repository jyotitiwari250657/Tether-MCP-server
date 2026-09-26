#!/usr/bin/env node
/**
 * make-demo-gif.ts — captures the README demo GIF through the real Tether loop
 * (AC-P13-08 stretch). Uses the e2e harness: real daemon + real Chrome, drives
 * browser_snapshot → browser_click via the daemon MCP HTTP endpoint, and records
 * ~20 frames of the resulting page, encoded with gifenc into docs/assets/demo.gif.
 *
 * Budget: 640x400, ~8 fps, target <= 2 MB. On any failure the script exits
 * non-zero and the repo keeps docs/assets/demo-placeholder.svg.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as gifenc from 'gifenc';
// gifenc's ESM build nests its exports under `default` depending on the loader.
const gif = (gifenc as unknown as { default?: typeof gifenc }).default ?? gifenc;
const { GIFEncoder, quantize, applyPalette } = gif;
import { startFixtureServer } from '../tests/e2e/fixtures';
import { launchTether } from '../tests/e2e/harness';
import { McpTestClient } from '../tests/e2e/helpers/mcp-client';
import { clickEnableInject } from '../tests/e2e/helpers/ui';

const WIDTH = 640;
const HEIGHT = 400;
const FPS = 8;
const TARGET_SECONDS = 2.5;
const FRAME_COUNT = Math.min(24, FPS * TARGET_SECONDS);
const OUT = resolve(process.cwd(), 'docs/assets/demo.gif');
const MAX_BYTES = 2 * 1024 * 1024;

interface RgbaFrame {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

/** Decodes a PNG buffer to RGBA pixels using the browser's own canvas codec. */
async function decodePng(browser: import('playwright').Browser, png: Buffer): Promise<RgbaFrame> {
  const page = await browser.newPage();
  try {
    const b64 = png.toString('base64');
    return (await page.evaluate(async (dataUrl) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return { width: d.width, height: d.height, data: Array.from(d.data) };
    }, `data:image/png;base64,${b64}`)) as unknown as RgbaFrame;
  } finally {
    await page.close();
  }
}

async function main(): Promise<void> {
  const fixtureServer = await startFixtureServer(4850);
  const harness = await launchTether({ daemon: true });
  const client = new McpTestClient(harness.httpPort);

  try {
    await client.connect();

    const page = await harness.ctx.newPage();
    await page.setViewportSize({ width: WIDTH, height: HEIGHT });
    await page.goto(`${fixtureServer.url}/static-1`);
    await page.bringToFront();
    // Grant the fixture origin the same way the eval suite does (user gesture in popup).
    await clickEnableInject(harness.ctx, harness.extensionId);

    const snap = await client.call('browser_snapshot', { url: page.url() });
    if (!snap.ok) throw new Error(`snapshot failed: ${snap.error?.code}`);
    const tree = (snap.data as { tree?: string }).tree ?? '';
    const refMatch =
      tree.match(/\[ref=(A\d+)\][^\n]*button[^\n]*"Read More"/i) ??
      tree.match(/button\s+"Read More"\s+\[ref=(A\d+)\]/i) ??
      tree.match(/\[ref=(A\d+)\][^\n]*Read More/i);
    if (!refMatch?.[1]) throw new Error('Read More ref not found in snapshot tree');
    const ref = refMatch[1];
    console.log(`snapshot ok — Read More ref: ${ref}`);

    const browser = harness.ctx.browser();
    if (!browser) throw new Error('browser not available from context');

    const frames: RgbaFrame[] = [];
    const shoot = async (): Promise<void> => {
      const buf: Buffer = await page.screenshot({ type: 'png' });
      frames.push(await decodePng(browser, buf));
    };

    // Caption overlay in DOM so it appears inside screenshots (no compositing).
    // Light Ribbon caption: white pill, surface text, teal accent dot (docs/DESIGN.md).
    const showCaption = async (text: string): Promise<void> => {
      await page.evaluate((t) => {
        let el = document.getElementById('tether-demo-caption') as HTMLDivElement | null;
        if (!el) {
          el = document.createElement('div');
          el.id = 'tether-demo-caption';
          el.style.cssText =
            'position:fixed;left:12px;bottom:10px;background:#FFFFFFF2;color:#22303E;' +
            'border:1px solid #DDE3E8;box-shadow:0 1px 2px rgba(16,24,40,.06),0 8px 24px rgba(16,24,40,.08);' +
            'font:600 13px system-ui;padding:6px 10px;border-radius:12px;z-index:99999;' +
            'border-left:3px solid #0F8A72;';
          document.body.appendChild(el);
        }
        el.textContent = `Tether · ${t}`;
      }, text);
    };

    // Fake cursor in DOM, moved between steps so clicks are visible in frames.
    await page.evaluate(() => {
      const cur = document.createElement('div');
      cur.id = 'tether-demo-cursor';
      cur.style.cssText =
        'position:fixed;width:14px;height:14px;border:2px solid #1D6FB8;border-radius:50%;' +
        'background:#1D6FB855;pointer-events:none;z-index:99998;transition:all .18s ease;left:20px;top:20px;';
      document.body.appendChild(cur);
    });
    const moveCursor = async (x: number, y: number): Promise<void> => {
      await page.evaluate(
        ([x, y]) => {
          const cur = document.getElementById('tether-demo-cursor');
          if (cur) {
            cur.style.left = `${x}px`;
            cur.style.top = `${y}px`;
          }
        },
        [x, y] as unknown as Parameters<typeof page.evaluate>[0],
      );
    };

    await showCaption('browser_snapshot');
    for (let i = 0; i < 4; i++) await shoot();

    const btn = page.locator('#read-btn');
    const box = await btn.boundingBox();
    if (box) await moveCursor(box.x + box.width / 2, box.y + box.height / 2);
    await showCaption('browser_click [ref]');
    for (let i = 0; i < 3; i++) await shoot();

    await client.call('browser_click', { ref, url: page.url() });
    await page.waitForTimeout(400);
    await showCaption('action executed · audit logged');
    for (let i = 0; i < 5; i++) await shoot();

    await showCaption('local · private · kill-switched');
    for (let i = 0; i < 3; i++) await shoot();

    // Downsample/pad the frame list to FRAME_COUNT.
    const picked: RgbaFrame[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const idx = Math.min(frames.length - 1, Math.floor((i / FRAME_COUNT) * frames.length));
      const f = frames[idx];
      if (f) picked.push(f);
    }

    const gif = GIFEncoder();
    const delay = Math.round(1000 / FPS);
    for (const f of picked) {
      const rgba = new Uint8Array(f.data as unknown as ArrayBufferLike);
      const palette = quantize(rgba, 256);
      const index = applyPalette(rgba, palette);
      gif.writeFrame(index, f.width, f.height, { palette, delay });
    }
    gif.finish();
    const out = Buffer.from(gif.bytes());
    if (out.length > MAX_BYTES)
      throw new Error(`GIF ${out.length} bytes exceeds ${MAX_BYTES} budget`);
    mkdirSync(join(process.cwd(), 'docs/assets'), { recursive: true });
    writeFileSync(OUT, out);
    console.log(
      `wrote ${OUT} (${(out.length / 1024).toFixed(0)} KB, ${picked.length} frames @${FPS}fps)`,
    );
  } finally {
    await client.close().catch(() => {});
    await harness.close().catch(() => {});
    await fixtureServer.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('demo capture failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
