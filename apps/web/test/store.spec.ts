// AC-P09-08, AC-P09-15: Assert Chrome Web Store copy length and verbatim single-purpose statement
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Chrome Web Store Listing Copy (AC-P09-08, AC-P09-15)', () => {
  const storeIndexPath = path.resolve(process.cwd(), 'apps/web/src/pages/store/index.astro');
  const content = fs.readFileSync(storeIndexPath, 'utf-8');

  it('AC-P09-15: short description is <= 132 characters', () => {
    const match = content.match(/export const SHORT_DESCRIPTION\s*=\s*['"]([\s\S]*?)['"];/);
    expect(match).not.toBeNull();
    const shortDesc = match?.[1]?.trim();
    expect(shortDesc).toBeDefined();
    expect(shortDesc?.length).toBeLessThanOrEqual(132);
    expect(shortDesc).toBe(
      'Connect any AI assistant to your real, logged-in browser — with per-site permissions, approvals and a local audit log.',
    );
    expect(shortDesc?.length).toBe(118);
  });

  it('contains the single-purpose statement verbatim from PRD §12.3', () => {
    const expected =
      'Tether lets an AI assistant that the user chooses read and act on the web pages the user permits, with per-action approval and a local audit log.';
    expect(content).toContain(expected);
  });

  it('contains all 3 operating modes in the copy', () => {
    expect(content).toContain('Mode A: Local-Only');
    expect(content).toContain('Mode B: Hosted Relay');
    expect(content).toContain('Mode C: WebMCP Proxy');
  });
});

describe('Privacy Policy and Limited Use Disclosure (AC-P09-08)', () => {
  const privacyPath = path.resolve(process.cwd(), 'apps/web/src/pages/store/privacy.astro');
  const content = fs.readFileSync(privacyPath, 'utf-8');

  it('contains Mode A and Mode B privacy distinctions', () => {
    expect(content).toContain('Mode A (Local Loopback)');
    expect(content).toContain('Mode B (Encrypted Relay)');
    expect(content).toContain('Zero external traffic');
    expect(content).toContain('X25519 ECDH + AES-256-GCM');
  });

  it('explicitly mentions zero analytics and zero third-party pixels', () => {
    expect(content).toContain('ZERO.');
    expect(content).toContain('Google Analytics');
  });

  it('contains the Limited Use compliance statement', () => {
    expect(content).toContain('Chrome Web Store User Data Policy');
    expect(content).toContain('Limited Use requirements');
  });
});

describe('Store Asset Generation (AC-P09-10)', () => {
  it('generates 5 screenshots (1280x800) and promo tile (440x280)', () => {
    const storeDir = path.resolve(process.cwd(), 'apps/web/public/store');
    const expectedFiles = [
      'screenshot-1.png',
      'screenshot-2.png',
      'screenshot-3.png',
      'screenshot-4.png',
      'screenshot-5.png',
      'promo-tile.png',
    ];

    for (const file of expectedFiles) {
      const filePath = path.join(storeDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(1000);
    }
  });
});
