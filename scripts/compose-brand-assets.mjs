#!/usr/bin/env node
// compose-brand-assets.mjs — 14-FIX-02 (≤250 lines). Raster logo-ref.jpg source of truth.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BG_DIST = 24; // per-channel distance to background
const MIN_ISLAND = 16; // despeckle: drop alpha islands smaller than this

/** Contiguous [start,end] runs of truthy values in a 1-D projection. */
function runs(values, minLen) {
  const out = [];
  let s = -1;
  for (let i = 0; i <= values.length; i++) {
    const on = i < values.length && values[i] > 0;
    if (on && s < 0) s = i;
    if (!on && s >= 0) {
      if (i - s >= minLen) out.push([s, i - 1]);
      s = -1;
    }
  }
  return out;
}

/** 4-connected island labeling; removes islands smaller than MIN_ISLAND. */
function despeckle(mask, w, h) {
  const seen = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || seen[i]) continue;
    const stack = [i];
    const island = [];
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop();
      island.push(p);
      const x = p % w;
      const y = (p / w) | 0;
      const nb = [x ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb)
        if (q >= 0 && mask[q] && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
    }
    if (island.length < MIN_ISLAND) for (const p of island) mask[p] = 0;
  }
}

/** Counts per row of band (axis 'row') or per column of band (axis 'col'). */
function projection(mask, w, band, axis) {
  const rows = axis === 'row';
  const span = band[1] - band[0] + 1;
  const v = new Int32Array(rows ? span : w);
  for (let a = 0; a < v.length; a++) {
    let cnt = 0;
    for (let b = 0; b < (rows ? w : span); b++) {
      cnt += mask[rows ? (band[0] + a) * w + b : (band[0] + b) * w + a];
    }
    v[a] = cnt;
  }
  return v;
}

function bboxOf(mask, w, y0, y1) {
  let x0 = w;
  let x1 = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
    }
  }
  return { x0, x1, y0, y1 };
}

/** Slice a rect out of a full-image RGBA buffer (row-copy, no per-pixel work). */
function cropRgba(rgba, w, r) {
  const rw = r.x1 - r.x0 + 1;
  const rh = r.y1 - r.y0 + 1;
  const out = Buffer.alloc(rw * rh * 4);
  for (let y = 0; y < rh; y++) {
    const src = ((r.y0 + y) * w + r.x0) * 4;
    rgba.copy(out, y * rw * 4, src, src + rw * 4);
  }
  return { buf: out, raw: { width: rw, height: rh, channels: 4 } };
}

function assertBand(v, lo, hi, label) {
  if (v < lo || v > hi) {
    throw new Error(`brand assertion failed: ${label} = ${v.toFixed(3)} outside [${lo}, ${hi}]`);
  }
  console.log(`  assert ${label} = ${v.toFixed(3)} within [${lo}, ${hi}] ✓`);
}

const dir = (p) => mkdirSync(join(ROOT, p), { recursive: true });
async function save(img, rel) {
  dir(dirname(rel));
  const buf = await img.png({ compressionLevel: 9, effort: 7 }).toBuffer();
  writeFileSync(join(ROOT, rel), buf);
  console.log(`  wrote ${rel} (${buf.length} bytes)`);
}

async function main() {
  console.log('[1] background removal + despeckle');
  const src = join(ROOT, 'brand', 'logo-ref.jpg');
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const at = (x, y) => (y * w + x) * c;
  const rgb = (i) => [data[i], data[i + 1], data[i + 2]];
  const corners = [rgb(at(0, 0)), rgb(at(w - 1, 0)), rgb(at(0, h - 1)), rgb(at(w - 1, h - 1))];
  const bg = [0, 1, 2].map((k) => Math.round(corners.reduce((s, p) => s + p[k], 0) / 4));
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const s = i * c;
    const d = Math.max(...[0, 1, 2].map((k) => Math.abs(data[s + k] - bg[k])));
    if (d >= BG_DIST) mask[i] = 1;
  }
  despeckle(mask, w, h);
  const stackRgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const s = i * c;
    stackRgba[o] = data[s];
    stackRgba[o + 1] = data[s + 1];
    stackRgba[o + 2] = data[s + 2];
    stackRgba[o + 3] = mask[i] ? 255 : 0;
  }
  await save(
    sharp(stackRgba, { raw: { width: w, height: h, channels: 4 } }),
    'brand/mark-stack.png',
  );

  console.log('[2] row projection → MARK / WORDMARK split');
  const bands = runs(projection(mask, w, [0, h - 1], 'row'), 6);
  if (bands.length !== 2) throw new Error(`expected 2 bands, got ${JSON.stringify(bands)}`);
  const [markRows, wordRows] = bands;
  const markRect = bboxOf(mask, w, markRows[0], markRows[1]);
  const wordRect = bboxOf(mask, w, wordRows[0], wordRows[1]);
  console.log(`  mark ${JSON.stringify(markRect)} wordmark ${JSON.stringify(wordRect)}`);

  console.log('[3] glyph split → drop glyph #1 (T) → brand/wordmark-ether.png');
  const glyphs = runs(projection(mask, w, wordRows, 'col'), 5);
  if (glyphs.length < 5) throw new Error(`expected ≥5 glyphs, got ${JSON.stringify(glyphs)}`);
  const etherRect = { ...wordRect, x0: glyphs[1][0], x1: glyphs[glyphs.length - 1][1] };
  console.log(`  glyphs ${JSON.stringify(glyphs)} → ETHER x[${etherRect.x0}..${etherRect.x1}]`);
  const ether = cropRgba(stackRgba, w, etherRect);
  await save(sharp(ether.buf, { raw: ether.raw }), 'brand/wordmark-ether.png');

  console.log('[4] compose horizontal lockup (mockup geometry)');
  const markH = markRect.y1 - markRect.y0 + 1;
  const markW = markRect.x1 - markRect.x0 + 1;
  const spanAt = (y) => {
    const xs = [];
    for (let x = 0; x < w; x++) if (mask[y * w + x]) xs.push(x);
    return xs.length ? [xs[0], xs[xs.length - 1]] : null;
  };
  const allSpans = [];
  let barBottom = markRect.y0;
  for (let y = markRect.y0; y <= markRect.y1; y++) {
    const sp = spanAt(y);
    allSpans.push(sp);
    if (sp && sp[1] - sp[0] + 1 >= 0.6 * markW) barBottom = y;
  }
  const stem = allSpans.slice(barBottom - markRect.y0 + 1).filter((s) => s !== null);
  if (stem.length === 0) throw new Error('stem rows not found');
  const stemRightEdge = Math.max(...stem.map((s) => s[1])) - markRect.x0 + 1;
  const overhang = 0.1 * markW;
  const wordmarkX = markW - overhang;
  const wordY = (markRect.y0 + barBottom) / 2 - markRect.y0;
  const capTarget = 0.34 * markH;
  const scale = capTarget / (etherRect.y1 - etherRect.y0 + 1);
  const wordW = Math.round((etherRect.x1 - etherRect.x0 + 1) * scale);
  const canvasW = Math.ceil(wordmarkX + wordW);
  const canvasH = markH;
  if (stemRightEdge + 0.02 * canvasW > wordmarkX) {
    throw new Error(`stem collision: stemRightEdge=${stemRightEdge} wordmarkX=${wordmarkX}`);
  }
  assertBand(overhang / markW, 0.06, 0.14, 'overhang fraction');
  assertBand(canvasW / canvasH, 2.8, 3.3, 'lockup aspect w/h');
  assertBand(markW / canvasW, 0.3, 0.36, 'mark share of width');
  const aspect = Number((canvasW / canvasH).toFixed(4));
  const markShare = Number((markW / canvasW).toFixed(4));
  const m = { markWidth: markW, stemRightEdge, wordmarkX, overhang, aspect, markShare };
  console.log(JSON.stringify(m));
  const mark = cropRgba(stackRgba, w, markRect);
  const scaledEther = await sharp(ether.buf, { raw: ether.raw })
    .resize(wordW, Math.round(capTarget), { fit: 'fill' })
    .png()
    .toBuffer();
  const noBg = { r: 0, g: 0, b: 0, alpha: 0 };
  const create = { width: canvasW, height: canvasH, channels: 4, background: noBg };
  const lockup = await sharp({ create })
    .composite([
      { input: mark.buf, raw: mark.raw, left: 0, top: 0 },
      { input: scaledEther, left: Math.round(wordmarkX), top: Math.round(wordY) },
    ])
    .png({ compressionLevel: 9, effort: 7 })
    .toBuffer();
  writeFileSync(join(ROOT, 'brand/lockup-horizontal.png'), lockup);

  console.log('[5] exports');
  const markImg = sharp(mark.buf, { raw: mark.raw });
  await save(markImg.clone(), 'brand/mark.png');
  await save(sharp(lockup).resize({ height: 240 }), 'apps/extension/public/brand-lockup.png');
  const mark232 = await markImg.clone().resize(232, 232, { fit: 'inside' }).png().toBuffer();
  const square = { create: { width: 256, height: 256, channels: 4, background: noBg } };
  const markSq = sharp(square).composite([{ input: mark232, gravity: 'centre' }]);
  await save(markSq, 'apps/extension/public/brand-mark.png');
  const tray = await markImg.clone().resize(32, 32, { fit: 'contain' }).png().toBuffer();
  dir('apps/daemon/assets');
  writeFileSync(join(ROOT, 'apps/daemon/assets/brand-tray.png'), tray);
  const tpl = await sharp(tray).grayscale().png().toBuffer();
  writeFileSync(join(ROOT, 'apps/daemon/assets/brand-tray-template.png'), tpl);
  await save(markImg.clone().resize(64, 64, { fit: 'contain' }), 'apps/web/public/favicon.png');
  const lock = await sharp(lockup).resize({ height: 140 }).png().toBuffer();
  const lockW = (await sharp(lock).metadata()).width;
  const tag = Buffer.from(
    '<svg width="700" height="60" xmlns="http://www.w3.org/2000/svg">' +
      '<text x="0" y="40" font-family="Arial, sans-serif" font-size="30" fill="#3D4C5C">' +
      'Private, local-first browser control for AI assistants</text></svg>',
  );
  const heroBg = { create: { width: 1200, height: 300, channels: 3, background: '#F3F5F7' } };
  const hero = sharp(heroBg).composite([
    { input: lock, left: 64, top: 80 },
    { input: tag, left: 64 + lockW + 48, top: 120 },
  ]);
  await save(hero, 'docs/assets/hero.png');
  const mock = sharp(join(ROOT, 'brand', 'popup-mock.jpg')).extract({
    left: 40,
    top: 60,
    width: 1520,
    height: 440,
  });
  await save(mock, 'docs/assets/popup-reference-crop.png');

  console.log('[6] icons from raster mark (generate-icons.mjs)');
  const { generateIcons } = await import('./generate-icons.mjs');
  await generateIcons();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
