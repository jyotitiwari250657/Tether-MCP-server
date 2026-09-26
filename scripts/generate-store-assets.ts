// PRD §12.3: Generator for Chrome Web Store screenshots (1280x800) and promo tile (440x280)
// Prompt 14 §3: re-skinned to the Light Ribbon theme (docs/DESIGN.md).
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';

interface AssetSpec {
  filename: string;
  width: number;
  height: number;
  title: string;
  subtitle: string;
  badge: string;
  details: string[];
}

const ASSET_SPECS: AssetSpec[] = [
  {
    filename: 'screenshot-1.png',
    width: 1280,
    height: 800,
    title: 'Side Panel Mid-Session',
    subtitle: 'Real-time tool execution ledger and snapshot inspector',
    badge: 'ACTIVE SESSION',
    details: [
      'Tool: browser_snapshot -> 14 refs generated',
      'Policy: Tier 1 (Read-Only) -> Auto-Approved',
      'Client: Claude Desktop via Stdio Daemon',
      'Status: Connected (127.0.0.1:4111)',
    ],
  },
  {
    filename: 'screenshot-2.png',
    width: 1280,
    height: 800,
    title: 'Tamper-Evident Audit Log',
    subtitle: 'Cryptographic write-ahead audit chain recording every tool call',
    badge: 'VERIFIED CHAIN',
    details: [
      'Entry #0042: browser_click(ref="A3") [SUCCESS]',
      'Entry #0043: browser_fill(ref="A1") [REDACTED]',
      'Hash: 4f8b9e...01c4 (SHA-256 Chain OK)',
      'Storage: Local chrome.storage.local',
    ],
  },
  {
    filename: 'screenshot-3.png',
    width: 1280,
    height: 800,
    title: 'Per-Domain Permission Manager',
    subtitle: 'Granular origin controls for Tier 1 Read and Tier 2 Action',
    badge: 'POLICY ENGINE',
    details: [
      'Origin: https://app.github.com -> Tier 1 Granted',
      'Origin: https://bank.example.com -> SENSITIVE (Default Deny)',
      'Action Confirmations: Prompt on Every Tier 2 Mutation',
      'Secret Vault: 3 Secrets Stored in OS Keychain',
    ],
  },
  {
    filename: 'screenshot-4.png',
    width: 1280,
    height: 800,
    title: 'Connected Client Matrix',
    subtitle: 'Multi-client support across CLI, IDE, and hosted web agents',
    badge: 'TRANSPORTS',
    details: [
      'Local Loopback (Mode A): Cursor IDE Connected',
      'Hosted Relay (Mode B): Claude 3.5 Sonnet Paired',
      'WebMCP Bridge (Mode C): 4 Tools Discovered',
      'Encryption: X25519 ECDH + AES-256-GCM Active',
    ],
  },
  {
    filename: 'screenshot-5.png',
    width: 1280,
    height: 800,
    title: 'One-Click Kill Switch',
    subtitle: 'Instant revocation aborting all actions within 200ms',
    badge: 'ABSOLUTE CONTROL',
    details: [
      'Abort Trigger: Extension Header / Keyboard Shortcut',
      'Sockets: Teardown completed in 34ms',
      'Client Tokens: All ephemeral tokens revoked',
      'State: Neutralized / Safe Idle',
    ],
  },
  {
    filename: 'promo-tile.png',
    width: 440,
    height: 280,
    title: 'TETHER',
    subtitle: 'Private Browser Connector for AI Agents',
    badge: 'LOCAL-FIRST',
    details: ['Per-Domain Permissions', 'Write-Ahead Audit Log'],
  },
];

// Light Ribbon tokens (docs/DESIGN.md — keep in sync; this file is asset-only, not component UI)
const K = {
  bg: '#F3F5F7',
  surface: '#FFFFFF',
  sunken: '#ECEFF2',
  line: '#DDE3E8',
  text900: '#22303E',
  text700: '#3D4C5C',
  text500: '#6B7A89',
  blueFg: '#1D6FB8',
  tealTint: '#E7F6F1',
  tealStroke: '#9AD8C9',
  tealFg: '#0F8A72',
} as const;

function buildSvg(spec: AssetSpec): string {
  const isSmall = spec.width === 440;
  const titleSize = isSmall ? 28 : 42;
  const subSize = isSmall ? 14 : 20;

  if (isSmall) {
    // Promo tile: light surface, RASTER lockup composited (no monogram synthesis).
    const detailLines = spec.details
      .map((line, idx) => {
        const y = 208 + idx * 26;
        return `<text x="40" y="${y}" fill="#3D4C5C" font-size="13" font-weight="600" font-family="Inter, system-ui, sans-serif">✓  ${line}</text>`;
      })
      .join('\n');
    return `<svg width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${spec.width}" height="${spec.height}" rx="16" fill="#F3F5F7" />
  <rect x="1" y="1" width="${spec.width - 2}" height="${spec.height - 2}" rx="15" fill="none" stroke="#DDE3E8" />
  <!-- raster brand-lockup.png composited at (24,28) height 56 by sharp -->
  <text x="40" y="150" fill="#22303E" font-size="24" font-weight="800" font-family="Inter, system-ui, sans-serif">Private Browser Connector for AI Agents</text>
  <rect x="40" y="166" width="118" height="24" rx="12" fill="#E7F6F1" stroke="#9AD8C9" />
  <text x="99" y="183" fill="#0F8A72" font-size="11" font-weight="700" font-family="Inter, system-ui, sans-serif" text-anchor="middle">LOCAL-FIRST</text>
  ${detailLines}
</svg>`;
  }

  const detailLines = spec.details
    .map((line, idx) => {
      const y = 360 + idx * 48;
      const fontSize = 18;
      return `<text x="120" y="${y}" fill="${K.text700}" font-size="${fontSize}" font-family="Inter, system-ui, sans-serif">✓  ${line}</text>`;
    })
    .join('\n');

  return `<svg width="${spec.width}" height="${spec.height}" viewBox="0 0 ${spec.width} ${spec.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2BB39A" />
      <stop offset="100%" stop-color="#1D6FB8" />
    </linearGradient>
  </defs>

  <!-- Light page background -->
  <rect width="${spec.width}" height="${spec.height}" fill="${K.bg}" />

  <!-- Surface card -->
  <rect x="2" y="2" width="${spec.width - 4}" height="${spec.height - 4}" rx="16" fill="${K.surface}" stroke="${K.line}" stroke-width="2" />

  <!-- Badge pill -->
  <rect x="120" y="80" width="160" height="32" rx="16" fill="${K.tealTint}" stroke="${K.tealStroke}" />
  <text x="200" y="102" fill="${K.tealFg}" font-size="14" font-weight="700" letter-spacing="1" font-family="Inter, system-ui, sans-serif" text-anchor="middle">${spec.badge}</text>

  <!-- Title & Subtitle -->
  <text x="120" y="170" fill="${K.text900}" font-size="${titleSize}" font-weight="800" font-family="Inter, system-ui, sans-serif">${spec.title}</text>
  <text x="120" y="220" fill="${K.text500}" font-size="${subSize}" font-family="Inter, system-ui, sans-serif">${spec.subtitle}</text>

  <!-- Detail Card -->
  <rect x="80" y="280" width="${spec.width - 160}" height="380" rx="12" fill="${K.bg}" stroke="${K.line}" stroke-width="1.5" />

  <!-- Details Content -->
  ${detailLines}
</svg>`;
}

export async function generateStoreAssets(outDir?: string): Promise<string[]> {
  const targetDir = outDir ?? path.resolve(process.cwd(), 'apps/web/public/store');
  fs.mkdirSync(targetDir, { recursive: true });

  // Raster lockup (brand/lockup-horizontal.png, derived by compose-brand-assets.mjs)
  const lockupPath = path.resolve(process.cwd(), 'brand', 'lockup-horizontal.png');
  const lockup = fs.existsSync(lockupPath) ? fs.readFileSync(lockupPath) : null;

  const generatedFiles: string[] = [];

  for (const spec of ASSET_SPECS) {
    const svg = buildSvg(spec);
    const dest = path.join(targetDir, spec.filename);
    const base = sharp(Buffer.from(svg));

    // Composite the raster lockup top-right (screenshots) / top-left (promo tile)
    if (lockup) {
      const h = spec.width === 440 ? 48 : 40;
      const chip = await sharp(lockup).resize({ height: h }).png().toBuffer();
      const chipW = (await sharp(chip).metadata()).width ?? h * 3;
      const top = spec.width === 440 ? 36 : 72;
      const left = spec.width === 440 ? 40 : spec.width - 120 - chipW;
      await base
        .composite([{ input: chip, left, top }])
        .png({ quality: 100 })
        .toFile(dest);
    } else {
      await base.png({ quality: 100 }).toFile(dest);
    }

    generatedFiles.push(dest);
  }

  return generatedFiles;
}

if (process.argv[1]?.endsWith('generate-store-assets.ts')) {
  generateStoreAssets()
    .then((files) => {
      console.log(`Generated ${files.length} store assets:`);
      for (const f of files) {
        console.log(` - ${path.basename(f)}`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('Store asset generator failed:', err);
      process.exit(1);
    });
}
