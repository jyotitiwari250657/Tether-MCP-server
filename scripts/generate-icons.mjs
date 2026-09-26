#!/usr/bin/env node
/**
 * generate-icons.mjs — Prompt 14 §2 / AC-F14-03 (14-FIX-01 rewrite).
 * Consumes the raster-derived brand/mark.png (scripts/compose-brand-assets.mjs)
 * and renders toolbar icons 16/48/128 on a WHITE rounded-square backing
 * (radius 22%, 1px #DDE3E8 edge) into public/icons/ + public/ (overwrite).
 * No SVG synthesis: brand/mark.png is the only mark source.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const markPath = join(root, 'brand', 'mark.png');

const SIZES = [16, 48, 128];
const dirs = [
  join(root, 'apps', 'extension', 'public', 'icons'),
  join(root, 'apps', 'extension', 'public'),
];
for (const d of dirs) if (!existsSync(d)) mkdirSync(d, { recursive: true });

/** White rounded-square backing: radius 22%, 1px #DDE3E8 edge. */
function backingSvg(size) {
  const r = Math.round(size * 0.22);
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" rx="${r}" fill="#FFFFFF" stroke="#DDE3E8" stroke-width="1"/></svg>`,
  );
}

/** Renders white-backed icons from brand/mark.png. Also invoked by compose-brand-assets.mjs. */
export async function generateIcons() {
  if (!existsSync(markPath)) {
    throw new Error('brand/mark.png missing — run `node scripts/compose-brand-assets.mjs` first');
  }
  const markPng = readFileSync(markPath);
  for (const size of SIZES) {
    const backing = await sharp(backingSvg(size)).png().toBuffer();
    // Mark inset to 76% of the tile so the monogram stays legible at 16px
    const markSize = Math.round(size * 0.76);
    const mark = await sharp(markPng)
      .resize(markSize, markSize, { fit: 'contain', kernel: 'lanczos3' })
      .png()
      .toBuffer();
    const icon = await sharp(backing)
      .composite([{ input: mark, gravity: 'centre' }])
      .png({ compressionLevel: 9 })
      .toBuffer();
    for (const d of dirs) writeFileSync(join(d, `icon${size}.png`), icon);
    console.log(`icon${size}.png (${icon.length} bytes)`);
  }
  console.log('icons derived from brand/mark.png — done');
}

if (process.argv[1]?.endsWith('generate-icons.mjs')) {
  await generateIcons();
}
