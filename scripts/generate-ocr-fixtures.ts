/**
 * OCR Fixture Generator (Prompt 11 §6, TRD §12.4).
 * Renders synthetic PNGs with known text and approximate bounding boxes.
 * NO REAL PII — every "secret" below is a documented test constant.
 *
 * Run via `pnpm generate` (wired in the root package.json with tsx).
 * Commit the outputs so public CI works without regenerating them.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const OUT_DIR = join(process.cwd(), 'packages', 'ocr', 'test', 'fixtures');

const WIDTH = 640;
const HEIGHT = 96;
const BG = { r: 255, g: 255, b: 255, alpha: 1 };
const FG = { r: 10, g: 10, b: 10, alpha: 1 };

interface Fixture {
  name: string;
  lines: Array<{ text: string; y: number }>;
}

/**
 * Test constants (safe to commit):
 *  - PAN 4532015112830366 — Luhn-valid Visa test number (same value used by
 *    tests/e2e scenarios; not a real card).
 *  - user@example.com, +1-555-0142 — RFC 2606 / 555-fake conventions.
 *  - sk_test_4eC39HqLyjWDarjtT1zdp7dc — Stripe docs test key shape.
 *  - GB82WEST12345698765432 — ISO 13616 example IBAN.
 *  - eyJ… payload — structurally invalid JWT (last segment is a word).
 */
const FIXTURES: Fixture[] = [
  { name: 'pan', lines: [{ text: 'Card 4532015112830366 ends 0366', y: 30 }] },
  { name: 'email', lines: [{ text: 'Contact user@example.com today', y: 30 }] },
  { name: 'bearer', lines: [{ text: 'Authorization: Bearer abc123XYZ_session', y: 30 }] },
  {
    name: 'multi',
    lines: [
      { text: 'Card 4532015112830366', y: 14 },
      { text: 'Mail user@example.com', y: 52 },
    ],
  },
  { name: 'plain', lines: [{ text: 'Quarterly revenue exceeded expectations', y: 30 }] },
];

function svgFor(lines: Fixture['lines']): string {
  const parts = lines.map(
    (l) =>
      `<text x="24" y="${l.y + 42}" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="34" fill="rgb(10,10,10)">${l.text}</text>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"><rect width="100%" height="100%" fill="white"/>${parts.join('')}</svg>`;
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const manifest: Array<{ file: string; width: number; height: number; lines: Fixture['lines'] }> =
    [];

  for (const f of FIXTURES) {
    const png = await sharp(Buffer.from(svgFor(f.lines)))
      .resize(WIDTH, HEIGHT)
      .flatten({ background: BG })
      .png()
      .toBuffer();
    const file = `${f.name}.png`;
    writeFileSync(join(OUT_DIR, file), png);
    manifest.push({ file, width: WIDTH, height: HEIGHT, lines: f.lines });
  }

  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${manifest.length} OCR fixtures to packages/ocr/test/fixtures`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
