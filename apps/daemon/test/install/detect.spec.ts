import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  configureAllDetectedHarnesses,
  detectInstalledHarnesses,
} from '../../src/install/index.js';

describe('Daemon Harness Auto-Detection (PRD FR-309, TRD §7.5)', () => {
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tether-detect-test-'));
    originalHome = process.env.HOME;
    process.env.HOME = tempDir;
    process.env.USERPROFILE = tempDir;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalHome;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects harnesses based on directory presence', () => {
    // Create ~/.codex and ~/.cursor directories
    fs.mkdirSync(path.join(tempDir, '.codex'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, '.cursor'), { recursive: true });

    const detected = detectInstalledHarnesses();
    const codex = detected.find((d) => d.name === 'codex');
    const cursor = detected.find((d) => d.name === 'cursor');
    const claude = detected.find((d) => d.name === 'claude-code');

    expect(codex?.exists).toBe(true);
    expect(cursor?.exists).toBe(true);
    expect(claude?.exists).toBe(false);
  });

  it('configures only detected harnesses', async () => {
    fs.mkdirSync(path.join(tempDir, '.codex'), { recursive: true });

    const { configured, skipped } = await configureAllDetectedHarnesses({ dryRun: true });
    expect(configured.some((c) => c.harness === 'codex')).toBe(true);
    expect(skipped.some((s) => s.name === 'claude-code')).toBe(true);
  });
});
