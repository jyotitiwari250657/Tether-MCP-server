import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyUpdate,
  checkForUpdate,
  isNewerVersion,
  verifySha256,
} from '../../src/update/index.js';

describe('Daemon Update Subsystem (TRD §7, HR-1, HR-14)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tether-update-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('correctly compares semver versions', () => {
    expect(isNewerVersion('0.1.0', '0.2.0')).toBe(true);
    expect(isNewerVersion('0.1.0', '1.0.0')).toBe(true);
    expect(isNewerVersion('0.1.0', '0.1.1')).toBe(true);
    expect(isNewerVersion('0.2.0', '0.1.0')).toBe(false);
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false);
  });

  it('verifies SHA256 hashes', () => {
    const data = Buffer.from('hello tether update', 'utf-8');
    const expectedHash = crypto.createHash('sha256').update(data).digest('hex');

    expect(verifySha256(data, expectedHash)).toBe(true);
    expect(verifySha256(data, 'wronghash')).toBe(false);
  });

  it('checks for updates via mock fetcher', async () => {
    const mockFetch = async () =>
      ({
        ok: true,
        json: async () => ({
          version: '0.2.0',
          url: 'https://example.com/tether-v0.2.0',
          sha256: 'abc',
          signature: 'def',
        }),
      }) as unknown as Response;

    const res = await checkForUpdate(
      '0.1.0',
      'https://example.com/latest.json',
      mockFetch as unknown as typeof fetch,
    );
    expect(res.updateAvailable).toBe(true);
    expect(res.release?.version).toBe('0.2.0');
  });

  it('applies update atomically with rollback capability', async () => {
    const targetPath = path.join(tempDir, 'tether.exe');
    fs.writeFileSync(targetPath, 'old-binary-content', 'utf-8');

    const newBinary = Buffer.from('new-binary-content', 'utf-8');
    const res = await applyUpdate(targetPath, newBinary);

    expect(res.success).toBe(true);
    expect(fs.readFileSync(targetPath, 'utf-8')).toBe('new-binary-content');
    expect(res.backupPath).toBeDefined();
    expect(fs.existsSync(res.backupPath!)).toBe(true);
    expect(fs.readFileSync(res.backupPath!, 'utf-8')).toBe('old-binary-content');
  });
});
